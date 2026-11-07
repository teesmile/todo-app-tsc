import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDays, toLocalDateString } from '../lib/dates'
import { getDb } from '../store/db'
import { add, createCategory, listCategories } from '../store/repository'
import { TaskList } from './taskList'

// Regression tests for the two findings of the review of Phase 8.

/**
 * Holds the next `put` (or `add`) on `table` open inside its transaction until
 * released. Dexie.waitFor keeps the transaction alive while it waits.
 */
function holdNextPut(table: 'tasks' | 'categories', method: 'put' | 'add' = 'put') {
  let release!: () => void
  const gate = new Promise<void>(r => (release = r))
  const t = getDb()[table]
  const real = (t[method] as (...args: unknown[]) => Promise<unknown>).bind(t)
  vi.spyOn(t, method).mockImplementationOnce(((...args: unknown[]) =>
    Dexie.waitFor(gate).then(() => real(...args))) as never)
  return () => act(async () => {
    release()
    await new Promise(r => setTimeout(r, 50))
  })
}

/** Moves the clock to `date` and lets useToday notice, as on returning to the tab. */
async function moveClockTo(date: Date) {
  vi.setSystemTime(date)
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('1: a save from a row that regrouped never deletes the newer draft', () => {
  it('keeps typing done after a midnight regroup, through a later regroup', async () => {
    const start = new Date(2026, 10, 7, 23, 59)
    vi.useFakeTimers({ now: start, toFake: ['Date'] })
    const tomorrow = toLocalDateString(addDays(start, 1))
    await add({ title: 'Midnight task', dueDate: tomorrow })
    const user = userEvent.setup()
    render(<TaskList />)
    await user.click(await screen.findByRole('button', { name: 'Edit "Midnight task"' }))
    const release = holdNextPut('tasks')
    await user.type(screen.getByRole('textbox', { name: 'Edit "Midnight task"' }), ' A{Enter}')

    // Midnight: Tomorrow becomes Today, so the row remounts in another group.
    await moveClockTo(addDays(start, 1))
    await waitFor(() => expect(within(screen.getByRole('region', { name: /^Today/ })).getByRole('textbox')).toBeInTheDocument())
    await user.type(within(screen.getByRole('region', { name: /^Today/ })).getByRole('textbox'), ' B')
    await release()

    // Another day: Today becomes Overdue, another remount.
    await moveClockTo(addDays(start, 2))
    const field = await within(await screen.findByRole('region', { name: /^Overdue/ })).findByRole('textbox')
    expect(field).toHaveValue('Midnight task A B')
  })
})

describe('2: typing during a label save is kept', () => {
  it('keeps text typed while a rename is saving, and saves it next without a false conflict', async () => {
    await createCategory({ name: 'Work', color: 'blue' })
    const user = userEvent.setup()
    render(<TaskList />)
    await user.click(await screen.findByRole('button', { name: 'Manage labels' }))
    const manager = screen.getByRole('dialog', { name: 'Labels' })
    const field = await within(manager).findByLabelText('Name of label "Work"')
    const release = holdNextPut('categories')
    await user.clear(field)
    await user.type(field, 'Job{Enter}')
    await user.type(field, 's')
    await release()

    expect(within(manager).getByRole('textbox', { name: /^Name of label/ })).toHaveValue('Jobs')
    expect((await listCategories())[0].name).toBe('Job')
    await user.keyboard('{Enter}')
    await waitFor(async () => expect((await listCategories())[0].name).toBe('Jobs'))
    expect(within(manager).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps text typed while a new label is being created', async () => {
    const user = userEvent.setup()
    render(<TaskList />)
    await user.click(await screen.findByRole('button', { name: 'Manage labels' }))
    const manager = screen.getByRole('dialog', { name: 'Labels' })
    const release = holdNextPut('categories', 'add')
    const name = within(manager).getByLabelText('New label')
    await user.type(name, 'Home{Enter}')
    await user.type(name, ' admin')
    await release()

    expect(name).toHaveValue('Home admin')
    expect((await listCategories()).map(c => c.name)).toEqual(['Home'])
  })
})
