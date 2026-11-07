import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getDb, TasksDB } from '../store/db'
import { add, createCategory, listCategories, remove, removeCategory, setTaskLabel, undoRemove, updateCategory } from '../store/repository'
import { TaskList } from './taskList'

// Regression tests for the three findings of the review of Phase 7.

async function otherTab(change: (db: TasksDB) => Promise<unknown>) {
  const db = new TasksDB()
  await db.open()
  await change(db)
  db.close()
}

describe('1: deleting a label never breaks a pending Undo', () => {
  it('undoes a task delete even after its label was deleted in between', async () => {
    const work = await createCategory({ name: 'Work', color: 'blue' })
    const task = await add({ title: 'Labelled', categoryIds: [work.id] })
    const token = await remove(task.id)
    await removeCategory(work.id)

    expect(await undoRemove(token!)).toBe(true)
    expect((await getDb().tasks.get(task.id))?.deletedAt).toBeNull()
  })
})

describe('2: label ticks are atomic memberships, never whole-list replacements', () => {
  it('keeps both labels when two tabs add different ones at the same time', async () => {
    const a = await createCategory({ name: 'A', color: 'red' })
    const b = await createCategory({ name: 'B', color: 'blue' })
    const task = await add({ title: 'Shared' })
    const tab2 = new TasksDB()
    await tab2.open()

    await Promise.all([setTaskLabel(task.id, a.id, true), setTaskLabel(task.id, b.id, true, { db: tab2 })])
    tab2.close()
    expect((await getDb().tasks.get(task.id))?.categoryIds.sort()).toEqual([a.id, b.id].sort())
  })

  it('removing one label leaves a label another tab just added', async () => {
    const a = await createCategory({ name: 'A', color: 'red' })
    const b = await createCategory({ name: 'B', color: 'blue' })
    const task = await add({ title: 'Shared', categoryIds: [a.id] })
    await otherTab(db => setTaskLabel(task.id, b.id, true, { db }))
    await setTaskLabel(task.id, a.id, false)
    expect((await getDb().tasks.get(task.id))?.categoryIds).toEqual([b.id])
  })

  it('applies quick ticks in the chooser without dropping one', async () => {
    await createCategory({ name: 'A', color: 'red' })
    await createCategory({ name: 'B', color: 'blue' })
    const task = await add({ title: 'Quick ticks' })
    const user = userEvent.setup()
    render(<TaskList />)
    await user.click(await screen.findByRole('button', { name: 'Labels for "Quick ticks": none' }))
    // Both ticks before the live query re-renders.
    const [boxA, boxB] = [screen.getByRole('checkbox', { name: 'A' }), screen.getByRole('checkbox', { name: 'B' })]
    boxA.click()
    boxB.click()
    await waitFor(async () => expect((await getDb().tasks.get(task.id))?.categoryIds).toHaveLength(2))
  })
})

describe('3: an untouched label name never overwrites another tab\'s rename', () => {
  it('shows the other tab\'s rename and writes nothing when the field is left untouched', async () => {
    const work = await createCategory({ name: 'Work', color: 'blue' })
    const user = userEvent.setup()
    render(<TaskList />)
    await user.click(await screen.findByRole('button', { name: 'Manage labels' }))
    const manager = screen.getByRole('dialog', { name: 'Labels' })
    await user.click(await within(manager).findByLabelText('Name of label "Work"'))

    await otherTab(db => updateCategory(work.id, { name: 'Office' }, { db }))
    const field = await within(manager).findByLabelText('Name of label "Office"')
    expect(field).toHaveValue('Office')
    await user.tab()
    await new Promise(r => setTimeout(r, 50))
    expect((await listCategories())[0].name).toBe('Office')
  })

  it('refuses a real rename that would overwrite a newer one, and says so', async () => {
    const work = await createCategory({ name: 'Work', color: 'blue' })
    const user = userEvent.setup()
    render(<TaskList />)
    await user.click(await screen.findByRole('button', { name: 'Manage labels' }))
    const manager = screen.getByRole('dialog', { name: 'Labels' })
    const field = await within(manager).findByLabelText('Name of label "Work"')
    await user.clear(field)
    await user.type(field, 'Job')
    await otherTab(db => updateCategory(work.id, { name: 'Office' }, { db }))
    await user.keyboard('{Enter}')

    expect(await within(manager).findByRole('alert')).toHaveTextContent('Renamed in another tab to "Office"')
    expect((await listCategories())[0].name).toBe('Office')
  })
})
