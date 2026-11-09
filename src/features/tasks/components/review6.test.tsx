import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screenSize } from '@/test/screen'
import { nextDay, toLocalDateString } from '../lib/dates'
import { getDb, TasksDB } from '../store/db'
import { add, listTasks, purgeGuestTombstones, remove, update } from '../store/repository'
import { AddTaskSheet } from './addTaskSheet'
import { TaskList } from './taskList'

// Regression tests for the four findings of the review of Phases 4-6.

const today = toLocalDateString(new Date())
const stored = async (id: string) => (await getDb().tasks.get(id))!

async function renderList() {
  // These tests are about the date groups: the Due date view (Newest is the default).
  window.history.replaceState(null, '', '/?sort=due')
  const user = userEvent.setup()
  render(<TaskList />)
  await waitFor(() => expect(screen.queryByText('Loading tasks')).not.toBeInTheDocument())
  return user
}

async function otherTab(change: (db: TasksDB) => Promise<unknown>) {
  const db = new TasksDB()
  await db.open()
  await change(db)
  db.close()
}

describe('1: the inline editor never overwrites another tab\'s edit', () => {
  it('writes nothing for an untouched editor, even after the title changed elsewhere', async () => {
    const task = await add({ title: 'Title A' })
    const user = await renderList()
    await user.click(await screen.findByRole('button', { name: 'Edit "Title A"' }))
    await otherTab(db => update(task.id, { title: 'Title B' }, { db }))
    // Wait until the live query has delivered B to the open editor's row.
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Edit "Title B"' })).toBeInTheDocument())

    await user.tab()
    await waitFor(async () => expect((await stored(task.id)).title).toBe('Title B'))
    await new Promise(r => setTimeout(r, 50))
    expect((await stored(task.id)).title).toBe('Title B')
  })

  it('refuses a real edit that would overwrite a newer change, and keeps yours on a second Enter', async () => {
    const task = await add({ title: 'Title A' })
    const user = await renderList()
    await user.click(await screen.findByRole('button', { name: 'Edit "Title A"' }))
    await user.type(screen.getByRole('textbox', { name: 'Edit "Title A"' }), ' (mine)')
    await otherTab(db => update(task.id, { title: 'Title B' }, { db }))

    await user.keyboard('{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Changed in another tab to "Title B"')
    expect((await stored(task.id)).title).toBe('Title B')

    await user.keyboard('{Enter}')
    await waitFor(async () => expect((await stored(task.id)).title).toBe('Title A (mine)'))
  })

  it('keeps theirs on Escape after a conflict', async () => {
    const task = await add({ title: 'Title A' })
    const user = await renderList()
    await user.click(await screen.findByRole('button', { name: 'Edit "Title A"' }))
    await user.type(screen.getByRole('textbox', { name: 'Edit "Title A"' }), ' (mine)')
    await otherTab(db => update(task.id, { title: 'Title B' }, { db }))
    await user.keyboard('{Enter}')
    await screen.findByRole('alert')
    await user.keyboard('{Escape}')

    expect((await stored(task.id)).title).toBe('Title B')
  })
})

describe('2: the bottom sheet keeps text typed during a save', () => {
  it('stays open with the newer text when more was typed while adding', async () => {
    screenSize.desktop = false
    let release!: () => void
    const db = getDb()
    const realAdd = db.tasks.add.bind(db.tasks)
    vi.spyOn(db.tasks, 'add').mockImplementationOnce(((...args: Parameters<typeof realAdd>) =>
      new Promise(resolve => (release = () => resolve(realAdd(...args))))) as typeof realAdd)

    function Harness() {
      const [open, setOpen] = useState(true)
      return <AddTaskSheet open={open} onOpenChange={setOpen} today={today} defaultDue={null} onAdded={() => {}} />
    }
    const user = userEvent.setup()
    render(<Harness />)
    const field = within(screen.getByRole('dialog', { name: 'Add a task' })).getByLabelText('New task')
    await user.type(field, 'First{Enter}')
    await user.type(field, 'Second')
    await act(async () => release())
    // Let the save's continuation (where the sheet used to close) run.
    await waitFor(async () => expect((await listTasks()).some(t => t.title === 'First')).toBe(true))
    await act(async () => new Promise(r => setTimeout(r, 50)))

    const sheet = screen.getByRole('dialog', { name: 'Add a task' })
    expect(sheet).toHaveAttribute('open')
    expect(within(sheet).getByLabelText('New task')).toHaveValue('FirstSecond')
  })
})

describe('3: a draft survives its task moving to another group', () => {
  it('keeps the editor, the draft and focus when another tab moves the task', async () => {
    const task = await add({ title: 'Movable', dueDate: today })
    const user = await renderList()
    await user.click(await screen.findByRole('button', { name: 'Edit "Movable"' }))
    await user.type(screen.getByRole('textbox', { name: 'Edit "Movable"' }), ' draft')

    await otherTab(db => update(task.id, { dueDate: nextDay(today) }, { db }))
    await waitFor(() => expect(within(screen.getByRole('region', { name: /^Tomorrow/ })).getByRole('textbox', { name: 'Edit "Movable"' })).toBeInTheDocument())
    const field = screen.getByRole('textbox', { name: 'Edit "Movable"' })
    expect(field).toHaveValue('Movable draft')
    // The moved editor takes focus in an effect, just after it mounts.
    await waitFor(() => expect(field).toHaveFocus())
  })
})

describe('4: Undo stays honest about tombstones', () => {
  it('keeps a guest tombstone for a day, so a paused Undo still works after another tab boots', async () => {
    const task = await add({ title: 'Paused undo' })
    await remove(task.id)
    // Another tab boots ten minutes later.
    await purgeGuestTombstones({ now: Date.now() + 10 * 60 * 1000 })
    expect(await getDb().tasks.get(task.id)).toBeDefined()
    // A day later it goes.
    await purgeGuestTombstones({ now: Date.now() + 25 * 60 * 60 * 1000 })
    expect(await getDb().tasks.get(task.id)).toBeUndefined()
  })

  it('says so when Undo finds the task already gone, instead of doing nothing', async () => {
    await add({ title: 'Gone for good' })
    const user = await renderList()
    await user.click(await screen.findByRole('button', { name: 'Delete "Gone for good"' }))
    const status = screen.getByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('Deleted "Gone for good"'))
    const id = (await getDb().tasks.where('ownerId').equals('guest').filter(t => t.title === 'Gone for good').first())!.id
    await getDb().tasks.delete(id)

    fireEvent.click(within(status).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(status).toHaveTextContent('couldn\'t be undone'))
  })
})
