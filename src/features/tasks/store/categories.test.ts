import type { Task } from './types'
import { describe, expect, it } from 'vitest'
import { filterTasks } from '../lib/filter'
import { groupTasks } from '../lib/group'
import { getDb } from './db'
import { add, CategoryNameError, createCategory, listCategories, MAX_CATEGORY_NAME_LENGTH, removeCategory, update, updateCategory } from './repository'

const today = '2026-11-07'
let n = 0
function task(overrides: Partial<Task> = {}): Task {
  n += 1
  return { id: `t${String(n).padStart(3, '0')}`, ownerId: 'guest', title: `Task ${n}`, completed: false, dueDate: null, isSample: 0, dirty: 0, rev: 1, createdAt: n, updatedAt: n, completedAt: null, deletedAt: null, vital: 0, categoryIds: [], ...overrides }
}

describe('vital', () => {
  it('filters to vital tasks, alone and with search', () => {
    const a = task({ title: 'Vital call', vital: 1 })
    const b = task({ title: 'Plain call' })
    const c = task({ title: 'Vital email', vital: 1 })
    expect(filterTasks([a, b, c], { filter: 'vital' }, today)).toEqual([a, c])
    expect(filterTasks([a, b, c], { filter: 'vital', query: 'call' }, today)).toEqual([a])
  })

  it('no longer lifts a vital task above newer ones: every group is newest added first (owner, 2026-11-09)', () => {
    const newer = task({ dueDate: today, createdAt: 1 })
    const vital = task({ dueDate: today, createdAt: 0, vital: 1 })
    const doneVital = task({ completed: true, completedAt: 5, vital: 1, createdAt: 3 })
    const doneLater = task({ completed: true, completedAt: 9, createdAt: 2 })
    const groups = Object.fromEntries(groupTasks([newer, vital, doneVital, doneLater], today).map(g => [g.key, g.tasks]))
    expect(groups.today).toEqual([newer, vital])
    expect(groups.done).toEqual([doneVital, doneLater])
  })

  it('stores the flag as 0 or 1', async () => {
    const created = await add({ title: 'Flag me' })
    expect((await update(created.id, { vital: true })).vital).toBe(1)
    expect((await update(created.id, { vital: false })).vital).toBe(0)
  })
})

describe('labels', () => {
  it('filters by label, combined with a filter and search', () => {
    const a = task({ title: 'Report', categoryIds: ['work'] })
    const b = task({ title: 'Report draft', categoryIds: ['work', 'home'], vital: 1 })
    const c = task({ title: 'Groceries', categoryIds: ['home'] })
    expect(filterTasks([a, b, c], { label: 'work' }, today)).toEqual([a, b])
    expect(filterTasks([a, b, c], { label: 'work', filter: 'vital' }, today)).toEqual([b])
    expect(filterTasks([a, b, c], { label: 'home', query: 'groc' }, today)).toEqual([c])
  })

  it('trims names, limits them to 40 characters, and rejects duplicates ignoring case', async () => {
    const work = await createCategory({ name: '  Work  ', color: 'blue' })
    expect(work.name).toBe('Work')
    await expect(createCategory({ name: 'work', color: 'red' })).rejects.toBeInstanceOf(CategoryNameError)
    await expect(createCategory({ name: '   ', color: 'red' })).rejects.toThrow('A label needs a name.')
    await expect(createCategory({ name: 'x'.repeat(MAX_CATEGORY_NAME_LENGTH + 1), color: 'red' })).rejects.toBeInstanceOf(CategoryNameError)
  })

  it('renames and recolours, and allows renaming to its own name in another case', async () => {
    const home = await createCategory({ name: 'Home', color: 'green' })
    await createCategory({ name: 'Work', color: 'blue' })
    expect((await updateCategory(home.id, { name: 'HOME', color: 'teal' }))).toMatchObject({ name: 'HOME', color: 'teal' })
    await expect(updateCategory(home.id, { name: 'work' })).rejects.toThrow('There\'s already a label called "Work".')
  })

  it('deleting a label takes it off its tasks, and touches nothing else', async () => {
    const work = await createCategory({ name: 'Work', color: 'blue' })
    const home = await createCategory({ name: 'Home', color: 'green' })
    const t1 = await add({ title: 'Both labels' })
    await update(t1.id, { categoryIds: [work.id, home.id], vital: true })
    const t2 = await add({ title: 'Work only' })
    await update(t2.id, { categoryIds: [work.id] })

    expect(await removeCategory(work.id)).toBe(2)
    expect((await listCategories()).map(c => c.name)).toEqual(['Home'])
    const after1 = await getDb().tasks.get(t1.id)
    expect(after1).toMatchObject({ title: 'Both labels', categoryIds: [home.id], vital: 1 })
    expect((await getDb().tasks.get(t2.id))?.categoryIds).toEqual([])
    // A tombstone, for sync.
    expect((await getDb().categories.get(work.id))?.deletedAt).not.toBeNull()
  })

  it('never stores the same label twice on a task', async () => {
    const work = await createCategory({ name: 'Work', color: 'blue' })
    const t = await add({ title: 'Once' })
    expect((await update(t.id, { categoryIds: [work.id, work.id] })).categoryIds).toEqual([work.id])
  })
})
