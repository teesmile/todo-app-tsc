import type { TestUser } from '@/test/localSupabase'
import Dexie from 'dexie'
import postgres from 'postgres'
import { afterEach, describe, expect, it } from 'vitest'
import { clientFor, createUser, localDbUrl } from '@/test/localSupabase'
import { TasksDB } from '../store/db'
import { add, remove, UNDO_WINDOW_MS, update } from '../store/repository'
import { importGuestTasks } from './account'
import { syncNow } from './engine'
import { supabaseRemote } from './supabaseRemote'

/**
 * Sync end to end against the local stack: the real Data API, the real
 * trigger and row-level security, with Dexie databases as devices.
 */

const opened: TasksDB[] = []
async function device(user: TestUser, name: string, { secondClient = false } = {}) {
  const db = new TasksDB(`sync-db-${name}-${crypto.randomUUID()}`)
  await db.open()
  opened.push(db)
  const remote = supabaseRemote(secondClient ? clientFor(user.id) : user.db)
  const sync = (now = Date.now() + UNDO_WINDOW_MS + 1000) => syncNow({ db, remote, userId: user.id, now: () => now })
  return { db, sync }
}

afterEach(async () => {
  for (const db of opened.splice(0)) {
    db.close()
    await Dexie.delete(db.name)
  }
})

describe('sync against the real server', () => {
  it('a delete on one device beats a later offline edit on another, for one user on two clients', async () => {
    const user = await createUser('two-devices')
    const a = await device(user, 'a')
    const b = await device(user, 'b', { secondClient: true })
    const task = await add({ title: 'Pay rent' }, { db: a.db, ownerId: user.id })
    await a.sync()
    await b.sync()
    expect((await b.db.tasks.get(task.id))?.title).toBe('Pay rent')

    await remove(task.id, { db: a.db })
    await a.sync()
    await new Promise(r => setTimeout(r, 20))
    await update(task.id, { title: 'Pay rent today' }, { db: b.db })
    await b.sync()
    await a.sync()

    expect((await a.db.tasks.get(task.id))?.deletedAt).not.toBeNull()
    expect((await b.db.tasks.get(task.id))?.deletedAt).not.toBeNull()
    const { data } = await user.db.from('tasks').select('deleted_at').eq('id', task.id).single()
    expect(data?.deleted_at).not.toBeNull()
  })

  it('never brings one user\'s synced rows to another user\'s device', async () => {
    const alice = await createUser('alice')
    const bob = await createUser('bob')
    const aDevice = await device(alice, 'alice')
    const bDevice = await device(bob, 'bob')
    await add({ title: 'Alice\'s secret' }, { db: aDevice.db, ownerId: alice.id })
    await aDevice.sync()
    await add({ title: 'Bob\'s list' }, { db: bDevice.db, ownerId: bob.id })
    await bDevice.sync()

    expect((await bDevice.db.tasks.toArray()).filter(t => t.ownerId !== 'guest').map(t => t.title)).toEqual(['Bob\'s list'])
    expect((await aDevice.db.tasks.toArray()).filter(t => t.ownerId !== 'guest').map(t => t.title)).toEqual(['Alice\'s secret'])
  })

  it('pulls a write that committed after the cursor had passed its stamp', async () => {
    const user = await createUser('late')
    const a = await device(user, 'a')
    const b = await device(user, 'b', { secondClient: true })
    const task = await add({ title: 'Before' }, { db: a.db, ownerId: user.id })
    await a.sync()

    const sql = postgres(localDbUrl(), { max: 2, onnotice: () => {} })
    try {
      await sql.begin(async (tx) => {
        // now() is this transaction's start: the row is stamped here...
        await tx`update public.tasks set title = 'Committed late', updated_at = now() + interval '1 second' where id = ${task.id}`
        // ...while another write commits with a later stamp and A's cursor moves past ours.
        await add({ title: 'Meanwhile' }, { db: b.db, ownerId: user.id })
        await b.sync()
        await a.sync()
        expect((await a.db.tasks.get(task.id))?.title).toBe('Before')
      })
    }
    finally {
      await sql.end()
    }
    await a.sync()
    expect((await a.db.tasks.get(task.id))?.title).toBe('Committed late')
  })

  it('pushes a task brought over from the old app, longer than you can type, end to end', async () => {
    const user = await createUser('legacy')
    const a = await device(user, 'a')
    const long = `Imported: ${'x'.repeat(2000)}`
    // A legacy row: a guest task with a title past the 500 you can type.
    const base = await add({ title: 'placeholder' }, { db: a.db })
    await a.db.tasks.put({ ...base, title: long })

    expect(await importGuestTasks(user.id, { db: a.db })).toBe(1)
    await a.sync()
    const { data } = await user.db.from('tasks').select('title').eq('id', base.id).single()
    expect(data?.title).toBe(long)
  })
})
