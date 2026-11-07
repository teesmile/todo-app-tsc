import { describe, expect, it, vi } from 'vitest'
import { getDb, resetDbForTests, TasksDB } from './db'
import { add, clearSamples, listTasks, MAX_TITLE_LENGTH, remove, TaskNotFoundError, TitleError, undoRemove, update } from './repository'

// Reopening the database is what a page reload does: a new connection, the
// same stored data.
async function reopen() {
  resetDbForTests()
  return listTasks()
}

async function userTasks() {
  return (await listTasks()).filter(task => task.isSample === 0)
}

describe('seeding', () => {
  it('seeds the five sample tasks once, and only once', async () => {
    expect((await listTasks()).filter(t => t.isSample === 1)).toHaveLength(5)
    expect((await reopen()).filter(t => t.isSample === 1)).toHaveLength(5)
  })

  it('gives every sample a UUID and puts the due dates around today', async () => {
    const samples = await listTasks()
    for (const sample of samples)
      expect(sample.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const dated = samples.filter(s => s.dueDate !== null)
    expect(dated).toHaveLength(4)
    expect(samples.filter(s => s.dueDate === null)).toHaveLength(1)
  })
})

describe('persistence', () => {
  it('keeps an edit after a reopen', async () => {
    const task = await add({ title: 'Book train tickets' })
    await update(task.id, { title: 'Book train tickets for Friday', completed: true })

    const [stored] = (await reopen()).filter(t => t.id === task.id)
    expect(stored).toMatchObject({ title: 'Book train tickets for Friday', completed: true })
    expect(stored.completedAt).not.toBeNull()
  })

  it('keeps a delete after a reopen', async () => {
    const task = await add({ title: 'Cancel gym membership' })
    await remove(task.id)

    expect((await reopen()).some(t => t.id === task.id)).toBe(false)
    // Still there as a tombstone, so the delete can be undone and synced.
    expect((await getDb().tasks.get(task.id))?.deletedAt).not.toBeNull()
  })

  it('rejects an empty title, and one longer than the limit', async () => {
    await expect(add({ title: '   ' })).rejects.toThrow('A task needs a title')
    await expect(add({ title: 'x'.repeat(MAX_TITLE_LENGTH + 1) })).rejects.toBeInstanceOf(TitleError)
    expect((await add({ title: 'x'.repeat(MAX_TITLE_LENGTH) })).title).toHaveLength(MAX_TITLE_LENGTH)
  })
})

describe('tombstones', () => {
  it('refuses to edit a deleted task', async () => {
    const task = await add({ title: 'Return library book' })
    await remove(task.id)

    await expect(update(task.id, { title: 'edited after delete' })).rejects.toBeInstanceOf(TaskNotFoundError)
    expect((await getDb().tasks.get(task.id))?.title).toBe('Return library book')
  })

  it('returns no token for a second delete of the same task', async () => {
    const task = await add({ title: 'Pay the electricity bill' })
    expect(await remove(task.id)).not.toBeNull()
    expect(await remove(task.id)).toBeNull()
  })
})

describe('undo', () => {
  it('restores the task, keeping an edit another tab made before the delete', async () => {
    const task = await add({ title: 'Draft the report' })
    const otherTab = new TasksDB()
    await update(task.id, { title: 'Draft the quarterly report' }, { db: otherTab })

    const token = await remove(task.id)
    expect(await undoRemove(token!)).toBe(true)

    const [restored] = (await listTasks()).filter(t => t.id === task.id)
    expect(restored.title).toBe('Draft the quarterly report')
    otherTab.close()
  })

  it('works once: a second undo with the same token does nothing', async () => {
    const task = await add({ title: 'Email the landlord' })
    const token = await remove(task.id)
    expect(await undoRemove(token!)).toBe(true)
    await remove(task.id)
    expect(await undoRemove(token!)).toBe(false)
    expect((await listTasks()).some(t => t.id === task.id)).toBe(false)
  })

  it('can\'t undo a newer delete with an older token, even within the same millisecond', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T12:00:00Z'), toFake: ['Date'] })
    try {
      const task = await add({ title: 'Order printer ink' })
      const oldToken = await remove(task.id)
      await undoRemove(oldToken!)
      await remove(task.id)

      expect(await undoRemove(oldToken!)).toBe(false)
      expect((await listTasks()).some(t => t.id === task.id)).toBe(false)
    }
    finally {
      vi.useRealTimers()
    }
  })
})

describe('samples', () => {
  it('clears untouched samples, and keeps user tasks and edited samples', async () => {
    const mine = await add({ title: 'My own task' })
    const [editedSample, completedSample] = (await listTasks()).filter(t => t.isSample === 1)
    await update(editedSample.id, { title: `${editedSample.title} this weekend` })
    await update(completedSample.id, { completed: true })

    expect(await clearSamples()).toBe(4)

    const left = await listTasks()
    expect(left.map(t => t.id).sort()).toEqual([mine.id, editedSample.id].sort())
  })

  it('treats a due-date change as an edit, but not completing', async () => {
    const [sample] = (await listTasks()).filter(t => t.isSample === 1)
    expect((await update(sample.id, { completed: true })).isSample).toBe(1)
    expect((await update(sample.id, { dueDate: '2030-01-01' })).isSample).toBe(0)
  })
})

describe('concurrency', () => {
  it('never resurrects a task when an update in one tab races a delete in another', async () => {
    const task = await add({ title: 'Renew car insurance' })
    // Open both connections first, so the update's read really is issued
    // before the delete; otherwise the open delay lets the delete win and the
    // test proves nothing.
    const otherTab = new TasksDB()
    await otherTab.open()

    await Promise.allSettled([
      update(task.id, { completed: true }, { db: otherTab }),
      remove(task.id),
    ])

    expect((await listTasks()).some(t => t.id === task.id)).toBe(false)
    otherTab.close()
  })

  it('keeps both edits when two tabs change different fields at once', async () => {
    const task = await add({ title: 'Book dentist' })
    const otherTab = new TasksDB()
    await otherTab.open()

    await Promise.all([
      update(task.id, { title: 'Book dentist for Friday' }),
      update(task.id, { completed: true }, { db: otherTab }),
    ])

    const [stored] = (await listTasks()).filter(t => t.id === task.id)
    expect(stored).toMatchObject({ title: 'Book dentist for Friday', completed: true })
    otherTab.close()
  })

  it('rejects, and leaves the row unchanged, when the transaction aborts after its write', async () => {
    const task = await add({ title: 'Water the garden' })
    const db = getDb()
    const realPut = db.tasks.put.bind(db.tasks)
    // Abort after the write succeeded: a quota or commit failure looks like
    // this, with no request error, just a rollback.
    const spy = vi.spyOn(db.tasks, 'put').mockImplementation(((...args: Parameters<typeof realPut>) =>
      realPut(...args).then(() => {
        throw new Error('simulated abort after write')
      })) as typeof db.tasks.put)
    try {
      await expect(update(task.id, { title: 'never committed' })).rejects.toThrow('simulated abort after write')
    }
    finally {
      spy.mockRestore()
    }
    expect((await getDb().tasks.get(task.id))?.title).toBe('Water the garden')
  })

  it('lists tasks newest first', async () => {
    const first = await add({ title: 'First' })
    const second = await add({ title: 'Second' })
    const ids = (await userTasks()).map(t => t.id)
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id))
  })
})
