import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { resetDbForTests, TASKS_DB_NAME, TasksDB } from './db'
import { listTasks } from './repository'

// The rows a user could have in a version-1 database, written exactly as the
// version-1 code wrote them (no vital, no categoryIds).
const v1Rows = [
  { id: 'a1111111-1111-4111-8111-111111111111', ownerId: 'guest', title: 'Live task', completed: false, dueDate: '2026-11-07', isSample: 0, dirty: 1, rev: 3, createdAt: 1000, updatedAt: 2000, completedAt: null, deletedAt: null },
  { id: 'b2222222-2222-4222-8222-222222222222', ownerId: 'guest', title: 'Deleted task', completed: true, dueDate: null, isSample: 0, dirty: 1, rev: 5, createdAt: 1100, updatedAt: 2100, completedAt: 1500, deletedAt: 2100 },
  { id: 'c3333333-3333-4333-8333-333333333333', ownerId: 'guest', title: 'A sample', completed: false, dueDate: null, isSample: 1, dirty: 0, rev: 0, createdAt: 900, updatedAt: 900, completedAt: null, deletedAt: null },
  { id: 'd4444444-4444-4444-8444-444444444444', ownerId: 'guest', title: 'x'.repeat(687), completed: false, dueDate: null, isSample: 0, dirty: 1, rev: 1, createdAt: 800, updatedAt: 800, completedAt: null, deletedAt: null },
]

async function createVersion1Database() {
  const v1 = new Dexie(TASKS_DB_NAME)
  v1.version(1).stores({ tasks: 'id, ownerId, [ownerId+dirty], isSample', meta: 'key' })
  await v1.open()
  await v1.table('tasks').bulkAdd(v1Rows)
  await v1.table('meta').bulkAdd([{ key: 'installId', value: 'e5555555-5555-4555-8555-555555555555' }, { key: 'displayName', value: 'Toni' }])
  v1.close()
}

describe('schema version 2 migration', () => {
  it('keeps every version-1 row and field, and only adds the new defaults', async () => {
    await createVersion1Database()
    const db = new TasksDB()
    await db.open()

    expect(db.verno).toBe(2)
    const rows = await db.tasks.orderBy('id').toArray()
    expect(rows).toEqual(v1Rows.map(row => ({ ...row, vital: 0, categoryIds: [] })))
    expect(await db.meta.toArray()).toEqual([
      { key: 'displayName', value: 'Toni' },
      { key: 'installId', value: 'e5555555-5555-4555-8555-555555555555' },
    ])
    expect(await db.categories.count()).toBe(0)
    db.close()
  })

  it('does not seed samples into an existing database', async () => {
    await createVersion1Database()
    resetDbForTests()
    const live = await listTasks()
    // Two live version-1 tasks plus the version-1 sample, and nothing seeded on top.
    expect(live.map(t => t.title).sort()).toEqual(['A sample', 'Live task', 'x'.repeat(687)].sort())
  })

  it('is idempotent: reopening a migrated database changes nothing', async () => {
    await createVersion1Database()
    const first = new TasksDB()
    await first.open()
    const before = await first.tasks.toArray()
    first.close()
    const second = new TasksDB()
    await second.open()
    expect(await second.tasks.toArray()).toEqual(before)
    second.close()
  })

  it('creates new databases at version 2 directly, with one Vital sample', async () => {
    const live = await listTasks()
    expect(live).toHaveLength(5)
    expect(live.every(t => Array.isArray(t.categoryIds) && t.categoryIds.length === 0)).toBe(true)
    expect(live.filter(t => t.vital === 1).map(t => t.title)).toEqual(['Renew your passport'])
  })
})
