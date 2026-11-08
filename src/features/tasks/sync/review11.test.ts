import type { Remote, SyncTable } from './types'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeRemote } from '@/test/fakeRemote'
import { TasksDB } from '../store/db'
import { add, createCategory, remove, UNDO_WINDOW_MS, undoRemove, update } from '../store/repository'
import { GUEST } from '../store/types'
import { holdUndo } from '../store/undoHolds'
import { evictSignedOutUser, importGuestTasks } from './account'
import { cursorKey, SyncCancelledError, syncNow } from './engine'

// Regression tests for the four findings of review 11: interleavings
// between tabs, sign-out, Undo and import that the scenario tests missed.

const USER = '33333333-3333-4333-8333-333333333333'
let real = Date.UTC(2026, 10, 8, 9, 0, 0)
let remote: FakeRemote
const opened: TasksDB[] = []

/** Two connections to one database: two tabs of the same browser. */
async function tab(name = 'shared') {
  const db = new TasksDB(`review11-${name}`)
  await db.open()
  opened.push(db)
  return db
}

/** A remote whose next `kind` call on `table` waits at a gate after reaching the server. */
function gated(kind: 'pull' | 'push', table: SyncTable) {
  let release!: () => void
  const gate = new Promise<void>(r => (release = r))
  let reached!: () => void
  const atGate = new Promise<void>(r => (reached = r))
  let used = false
  const wrapped: Remote = {
    pull: async (t, r) => {
      const rows = await remote.pull(t, r)
      if (kind === 'pull' && t === table && !used) {
        used = true
        reached()
        await gate
      }
      return rows
    },
    push: async (t, rows) => {
      const stored = await remote.push(t, rows)
      if (kind === 'push' && t === table && !used) {
        used = true
        reached()
        await gate
      }
      return stored
    },
  }
  return { remote: wrapped, atGate, release }
}

const later = (ms = UNDO_WINDOW_MS + 1000) => (real += ms)
const sync = (db: TasksDB, r: Remote = remote) => syncNow({ db, remote: r, userId: USER })

beforeEach(() => {
  real = Date.UTC(2026, 10, 8, 9, 0, 0)
  vi.spyOn(Date, 'now').mockImplementation(() => real)
  remote = new FakeRemote(() => real)
})

afterEach(async () => {
  vi.restoreAllMocks()
  const names = new Set(opened.map(db => db.name))
  for (const db of opened.splice(0))
    db.close()
  for (const name of names)
    await Dexie.delete(name)
})

describe('1: a delayed pull never overwrites a newer synced version', () => {
  it('keeps another tab\'s acknowledged edit when an older pull lands after it', async () => {
    const [a, b] = [await tab(), await tab()]
    const task = await add({ title: 'Old title' }, { db: a, ownerId: USER })
    await sync(a)

    const slow = gated('pull', 'tasks')
    const running = sync(a, slow.remote)
    await slow.atGate
    later(1000)
    await update(task.id, { title: 'New title' }, { db: b })
    await sync(b)
    slow.release()
    await running

    expect((await a.tasks.get(task.id))?.title).toBe('New title')
    await update(task.id, { completed: true }, { db: a })
    await sync(a)
    expect(remote.rows.tasks.get(task.id)).toMatchObject({ title: 'New title', completed: true })
  })
})

describe('2: sign-out stops a sync already in flight', () => {
  it('writes no rows or cursor back after eviction, so the next sign-in restores everything', async () => {
    const a = await tab()
    const older = await add({ title: 'Older' }, { db: a, ownerId: USER })
    await sync(a)
    later(2 * 60_000)
    const newer = await add({ title: 'Newer' }, { db: a, ownerId: USER })
    await sync(a)

    const slow = gated('pull', 'tasks')
    const running = sync(a, slow.remote)
    await slow.atGate
    await evictSignedOutUser(USER, { db: a })
    slow.release()
    await expect(running).rejects.toBeInstanceOf(SyncCancelledError)

    expect(await a.tasks.where('ownerId').equals(USER).count()).toBe(0)
    expect(await a.meta.get(cursorKey(USER, 'tasks'))).toBeUndefined()

    await sync(a)
    expect((await a.tasks.where('ownerId').equals(USER).toArray()).map(t => t.id).sort()).toEqual([older.id, newer.id].sort())
  })
})

describe('3: Undo never races an outgoing delete', () => {
  it('refuses an Undo pressed while the delete is in flight, rather than reporting success', async () => {
    const a = await tab()
    const task = await add({ title: 'Going' }, { db: a, ownerId: USER })
    await sync(a)
    const token = await remove(task.id, { db: a })
    later()

    const slow = gated('push', 'tasks')
    const running = sync(a, slow.remote)
    await slow.atGate
    expect(await undoRemove(token!, { db: a })).toBe(false)
    slow.release()
    await running
    expect((await a.tasks.get(task.id))?.deletedAt).not.toBeNull()
    expect(remote.rows.tasks.get(task.id)?.deleted_at).not.toBeNull()
  })

  it('holds a delete while its Undo toast is on screen, however long it stays paused', async () => {
    const a = await tab()
    const task = await add({ title: 'Hovering over Undo' }, { db: a, ownerId: USER })
    await sync(a)
    const token = await remove(task.id, { db: a })
    const release = holdUndo([task.id])
    later(60_000)
    await sync(a)
    expect(remote.rows.tasks.get(task.id)?.deleted_at).toBeNull()

    expect(await undoRemove(token!, { db: a })).toBe(true)
    release()
    await sync(a)
    expect(remote.rows.tasks.get(task.id)?.deleted_at).toBeNull()
  })
})

describe('4: importing never strips a label from the guest tasks left behind', () => {
  it('copies a label still used by a sample that stays', async () => {
    const a = await tab('import')
    const home = await createCategory({ name: 'Home', color: 'green' }, { db: a })
    const mine = await add({ title: 'Mine', categoryIds: [home.id] }, { db: a })
    const sample = (await a.tasks.where('isSample').equals(1).first())!
    await a.tasks.put({ ...sample, categoryIds: [home.id] })

    await importGuestTasks(USER, { db: a })

    const left = await a.tasks.get(sample.id)
    expect(left).toMatchObject({ ownerId: GUEST, categoryIds: [home.id] })
    expect((await a.categories.get(home.id))?.ownerId).toBe(GUEST)
    const moved = (await a.tasks.get(mine.id))!
    const copy = (await a.categories.get(moved.categoryIds[0]))!
    expect(copy).toMatchObject({ ownerId: USER, name: 'Home', color: 'green' })
    expect(copy.id).not.toBe(home.id)
  })

  it('maps to the account\'s own label of the same name instead of copying', async () => {
    const a = await tab('import-map')
    const accountWork = await createCategory({ name: 'Work', color: 'blue' }, { db: a, ownerId: USER })
    const guestWork = await createCategory({ name: 'work', color: 'red' }, { db: a })
    const mine = await add({ title: 'Report', categoryIds: [guestWork.id] }, { db: a })

    await importGuestTasks(USER, { db: a })
    expect((await a.tasks.get(mine.id))?.categoryIds).toEqual([accountWork.id])
  })
})
