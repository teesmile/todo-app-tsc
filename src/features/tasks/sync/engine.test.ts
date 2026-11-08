import type { Remote } from './types'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeRemote, stampFromMicros } from '@/test/fakeRemote'
import { TasksDB } from '../store/db'
import { add, createCategory, remove, removeCategory, setTaskLabel, UNDO_WINDOW_MS, undoRemove, update } from '../store/repository'
import { GUEST } from '../store/types'
import { evictSignedOutUser, importCandidates, importGuestTasks, unsyncedCount } from './account'
import { cursorKey, purgeSyncedTombstones, pushAll, SYNCED_TOMBSTONE_RETENTION_MS, syncNow } from './engine'
import { taskToServer } from './mapping'
import { RemoteError } from './types'

const USER = '11111111-1111-4111-8111-111111111111'

// One controllable clock for everything. `skew` is how far the acting
// device's clock is from the server's real time.
let real = Date.UTC(2026, 10, 7, 12, 0, 0)
let skew = 0
let remote: FakeRemote
const opened: TasksDB[] = []

async function device(name: string) {
  const db = new TasksDB(`sync-test-${name}`)
  await db.open()
  opened.push(db)
  return db
}

function on(db: TasksDB, remoteOverride?: Remote) {
  return { db, remote: remoteOverride ?? remote, userId: USER, pageSize: 100 }
}

/** Moves real time on, past any undo window. */
function later(ms = UNDO_WINDOW_MS + 1000) {
  real += ms
}

const sync = (db: TasksDB) => syncNow(on(db))
const local = (db: TasksDB, id: string) => db.tasks.get(id)
const server = (id: string) => remote.rows.tasks.get(id)

beforeEach(() => {
  real = Date.UTC(2026, 10, 7, 12, 0, 0)
  skew = 0
  vi.spyOn(Date, 'now').mockImplementation(() => real + skew)
  remote = new FakeRemote(() => real)
})

afterEach(async () => {
  vi.restoreAllMocks()
  for (const db of opened.splice(0)) {
    db.close()
    await Dexie.delete(db.name)
  }
})

describe('deletes stay deleted', () => {
  it('a delete on A reaches B', async () => {
    const [a, b] = [await device('a'), await device('b')]
    const task = await add({ title: 'Pay rent' }, { db: a, ownerId: USER })
    await sync(a)
    await sync(b)
    expect((await local(b, task.id))?.deletedAt).toBeNull()

    await remove(task.id, { db: a })
    later()
    await sync(a)
    await sync(b)
    expect((await local(b, task.id))?.deletedAt).not.toBeNull()
  })

  it('an offline edit on B after A\'s delete doesn\'t bring the task back, on either device', async () => {
    const [a, b] = [await device('a'), await device('b')]
    const task = await add({ title: 'Pay rent' }, { db: a, ownerId: USER })
    await sync(a)
    await sync(b)

    await remove(task.id, { db: a })
    later()
    await sync(a)
    later(60_000)
    await update(task.id, { title: 'Pay rent today' }, { db: b })
    await sync(b)
    await sync(a)

    expect((await local(a, task.id))?.deletedAt).not.toBeNull()
    expect((await local(b, task.id))?.deletedAt).not.toBeNull()
    expect(server(task.id)?.deleted_at).not.toBeNull()
  })

  it('an Undo inside the window never sends the delete', async () => {
    const a = await device('a')
    const task = await add({ title: 'Keep me' }, { db: a, ownerId: USER })
    await sync(a)
    const token = await remove(task.id, { db: a })
    await sync(a)
    expect(server(task.id)?.deleted_at).toBeNull()

    expect(await undoRemove(token!, { db: a })).toBe(true)
    later()
    await sync(a)
    expect(server(task.id)?.deleted_at).toBeNull()
    expect((await local(a, task.id))?.deletedAt).toBeNull()
  })

  it('refuses a late Undo once the delete has synced (a toast paused past the window)', async () => {
    const a = await device('a')
    const task = await add({ title: 'Gone' }, { db: a, ownerId: USER })
    const token = await remove(task.id, { db: a })
    later()
    await sync(a)
    expect(server(task.id)?.deleted_at).not.toBeNull()
    expect(await undoRemove(token!, { db: a })).toBe(false)
    expect((await local(a, task.id))?.deletedAt).not.toBeNull()
  })
})

describe('nothing typed is lost', () => {
  it('an edit made while a push is in flight stays dirty and goes next time', async () => {
    const a = await device('a')
    const task = await add({ title: 'Draft' }, { db: a, ownerId: USER })
    const racing: Remote = {
      pull: (t, r) => remote.pull(t, r),
      push: async (t, rows) => {
        const stored = await remote.push(t, rows)
        if (t === 'tasks')
          await update(task.id, { title: 'Draft, edited mid-push' }, { db: a })
        return stored
      },
    }
    await syncNow(on(a, racing))
    expect(await local(a, task.id)).toMatchObject({ title: 'Draft, edited mid-push', dirty: 1 })
    expect(server(task.id)?.title).toBe('Draft')

    await sync(a)
    expect(server(task.id)?.title).toBe('Draft, edited mid-push')
    expect((await local(a, task.id))?.dirty).toBe(0)
  })

  it('keeps concurrent edits to different tasks, and the newer edit to the same task', async () => {
    const [a, b] = [await device('a'), await device('b')]
    const one = await add({ title: 'One' }, { db: a, ownerId: USER })
    const two = await add({ title: 'Two' }, { db: a, ownerId: USER })
    await sync(a)
    await sync(b)

    later(1000)
    await update(one.id, { title: 'One by A' }, { db: a })
    await update(two.id, { completed: true }, { db: b })
    later(1000)
    await update(one.id, { title: 'One by B, later' }, { db: b })
    await sync(a)
    await sync(b)
    await sync(a)

    for (const db of [a, b]) {
      expect((await local(db, one.id))?.title).toBe('One by B, later')
      expect((await local(db, two.id))?.completed).toBe(true)
    }
  })
})

describe('the pull cursor never skips a row', () => {
  it('a device offline for a week pushes old-timestamp work, and the other device still pulls it', async () => {
    const [a, b] = [await device('a'), await device('b')]
    await sync(a)
    const down = async (): Promise<never> => {
      throw new RemoteError('offline', 'no signal')
    }
    const noSignal: Remote = { pull: down, push: down }
    skew = -7 * 24 * 3600_000
    const old = await add({ title: 'Written on the train last week' }, { db: b, ownerId: USER })
    await expect(syncNow(on(b, noSignal))).rejects.toBeInstanceOf(RemoteError)
    skew = 0
    later(60_000)
    await sync(a)

    await sync(b)
    await sync(a)
    expect((await local(a, old.id))?.title).toBe('Written on the train last week')
  })

  it('pulls a row that committed late, stamped before the cursor but inside the overlap', async () => {
    const a = await device('a')
    await add({ title: 'First' }, { db: a, ownerId: USER })
    await sync(a)
    const cursor = (await a.meta.get(cursorKey(USER, 'tasks')))?.value as string
    expect(cursor).toBeTruthy()

    const lateRow = taskToServer({ ...(await add({ title: 'Late commit' }, { db: await device('scratch'), ownerId: USER })) }, USER)
    remote.commitLate('tasks', lateRow, (real - 10_000) * 1000)
    await sync(a)
    expect((await local(a, lateRow.id))?.title).toBe('Late commit')
  })

  it('brings in all 250 rows that share one server stamp, across three pages', async () => {
    const scratch = await device('scratch')
    const stamp = real * 1000
    for (let i = 0; i < 250; i++)
      remote.commitLate('tasks', taskToServer(await add({ title: `Row ${i}` }, { db: scratch, ownerId: USER }), USER), stamp)
    const b = await device('b')
    await sync(b)
    expect(await b.tasks.where('ownerId').equals(USER).count()).toBe(250)
  })
})

describe('clocks', () => {
  it('a fast clock wins by at most five minutes, and the device keeps the server\'s clamped time', async () => {
    const [a, b] = [await device('a'), await device('b')]
    const task = await add({ title: 'Clock test' }, { db: a, ownerId: USER })
    await sync(a)
    await sync(b)

    skew = 3600_000
    await update(task.id, { title: 'From the fast clock' }, { db: a })
    await sync(a)
    expect((await local(a, task.id))?.updatedAt).toBe(real + 5 * 60_000)

    skew = 0
    later(10 * 60_000)
    await sync(b)
    await update(task.id, { title: 'Ten minutes later, real time' }, { db: b })
    await sync(b)
    await sync(a)
    for (const db of [a, b])
      expect((await local(db, task.id))?.title).toBe('Ten minutes later, real time')
  })

  it('a slow clock\'s edit still beats the version it was made on', async () => {
    const [a, b] = [await device('a'), await device('b')]
    const task = await add({ title: 'Original' }, { db: a, ownerId: USER })
    later(1000)
    await sync(a)
    await sync(b)

    skew = -10 * 60_000
    await update(task.id, { title: 'Edited on the slow phone' }, { db: b })
    await sync(b)
    skew = 0
    await sync(a)
    expect((await local(a, task.id))?.title).toBe('Edited on the slow phone')
  })
})

describe('labels', () => {
  it('a label made on A and put on a task on B arrives with its colour', async () => {
    const [a, b] = [await device('a'), await device('b')]
    const task = await add({ title: 'Report' }, { db: a, ownerId: USER })
    const work = await createCategory({ name: 'Work', color: 'teal' }, { db: a, ownerId: USER })
    await sync(a)
    await sync(b)
    await setTaskLabel(task.id, work.id, true, { db: b })
    await sync(b)
    await sync(a)

    expect((await local(a, task.id))?.categoryIds).toEqual([work.id])
    expect(await b.categories.get(work.id)).toMatchObject({ name: 'Work', color: 'teal' })
  })

  it('a label deleted on A leaves B\'s tasks without it and otherwise unchanged', async () => {
    const [a, b] = [await device('a'), await device('b')]
    const work = await createCategory({ name: 'Work', color: 'blue' }, { db: a, ownerId: USER })
    const task = await add({ title: 'Report', dueDate: '2026-12-01', vital: true, categoryIds: [work.id] }, { db: a, ownerId: USER })
    await sync(a)
    await sync(b)

    later(1000)
    await removeCategory(work.id, { db: a })
    await sync(a)
    await sync(b)
    expect((await b.categories.get(work.id))?.deletedAt).not.toBeNull()
    expect(await local(b, task.id)).toMatchObject({ title: 'Report', dueDate: '2026-12-01', vital: 1, categoryIds: [] })
  })
})

describe('signing in and out', () => {
  it('imports guest tasks once, with their labels, leaving samples and over-long titles behind', async () => {
    const a = await device('a')
    const label = await createCategory({ name: 'Home', color: 'green' }, { db: a })
    const mine = await add({ title: 'Mine', categoryIds: [label.id] }, { db: a })
    await a.tasks.add({ ...mine, id: crypto.randomUUID(), title: 'x'.repeat(10_001) })
    expect(await importCandidates({ db: a })).toMatchObject({ own: 1, samples: 5 })

    expect(await importGuestTasks(USER, { db: a })).toBe(1)
    expect(await importGuestTasks(USER, { db: a })).toBe(0)
    await sync(a)

    expect([...remote.rows.tasks.values()].map(t => t.title)).toEqual(['Mine'])
    // The over-long task staying behind still uses "Home", so the account gets a copy.
    expect([...remote.rows.categories.values()].map(c => c.name)).toEqual(['Home'])
    expect((await a.categories.get(label.id))?.ownerId).toBe(GUEST)
    expect(await a.tasks.where('ownerId').equals(GUEST).filter(t => t.title.length > 10_000).count()).toBe(1)
    expect(await a.tasks.where('ownerId').equals(GUEST).filter(t => t.isSample === 1).count()).toBe(5)
  })

  it('sign-out keeps unsynced changes hidden on the device and removes the rest; signing back in restores everything', async () => {
    const a = await device('a')
    const synced = await add({ title: 'Synced' }, { db: a, ownerId: USER })
    await sync(a)
    remote.failing = 'offline'
    const pending = await add({ title: 'Not synced yet' }, { db: a, ownerId: USER })
    await expect(pushAll(on(a))).rejects.toBeInstanceOf(RemoteError)

    expect(await unsyncedCount(USER, { db: a })).toBe(1)
    expect(await evictSignedOutUser(USER, { db: a })).toBe(1)
    expect(await local(a, synced.id)).toBeUndefined()
    expect(await local(a, pending.id)).toMatchObject({ dirty: 1 })
    expect(await a.meta.get(cursorKey(USER, 'tasks'))).toBeUndefined()

    remote.failing = null
    await sync(a)
    expect((await local(a, synced.id))?.title).toBe('Synced')
    expect(server(pending.id)?.title).toBe('Not synced yet')
  })

  it('sign-out pushes a delete that\'s still in its undo window', async () => {
    const a = await device('a')
    const task = await add({ title: 'Delete then leave' }, { db: a, ownerId: USER })
    await sync(a)
    await remove(task.id, { db: a })
    await pushAll(on(a))
    expect(server(task.id)?.deleted_at).not.toBeNull()
    expect(await unsyncedCount(USER, { db: a })).toBe(0)
  })
})

describe('an unreachable server', () => {
  it('leaves the device working with its changes queued, and syncs them when it\'s back', async () => {
    const a = await device('a')
    remote.failing = 'unavailable'
    const task = await add({ title: 'Written while Supabase was paused' }, { db: a, ownerId: USER })
    await expect(sync(a)).rejects.toMatchObject({ kind: 'unavailable' })
    await update(task.id, { completed: true }, { db: a })
    expect(await local(a, task.id)).toMatchObject({ completed: true, dirty: 1 })

    remote.failing = null
    await sync(a)
    expect(server(task.id)).toMatchObject({ title: 'Written while Supabase was paused', completed: true })
  })

  it('never touches rows owned by someone else on this device', async () => {
    const a = await device('a')
    const guest = await add({ title: 'Guest task' }, { db: a })
    remote.commitLate('tasks', { ...taskToServer(guest, USER) }, real * 1000)
    await sync(a)
    expect(await local(a, guest.id)).toMatchObject({ ownerId: GUEST, title: 'Guest task' })
  })
})

describe('tidying', () => {
  it('drops synced tombstones after 30 days, never unsynced ones', async () => {
    const a = await device('a')
    const synced = await add({ title: 'Old delete' }, { db: a, ownerId: USER })
    const unsynced = await add({ title: 'Old, unsynced delete' }, { db: a, ownerId: USER })
    await remove(synced.id, { db: a })
    later()
    await sync(a)
    await remove(unsynced.id, { db: a })

    expect(await purgeSyncedTombstones(a, USER, Date.now() + SYNCED_TOMBSTONE_RETENTION_MS + 1)).toBe(1)
    expect(await local(a, synced.id)).toBeUndefined()
    expect(await local(a, unsynced.id)).toBeDefined()
  })
})

describe('server stamps', () => {
  it('keeps microsecond order that milliseconds would lose', () => {
    expect(stampFromMicros(1_000_001)).not.toBe(stampFromMicros(1_000_002))
  })
})
