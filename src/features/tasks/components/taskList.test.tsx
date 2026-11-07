import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { toLocalDateString } from '../lib/dates'
import { getDb, resetDbForTests } from '../store/db'
import { add, listTasks, MAX_TITLE_LENGTH } from '../store/repository'
import { TaskList } from './taskList'

const today = toLocalDateString(new Date())

/** Adds tasks one second apart, so newest-first order is deterministic. */
async function addInOrder(...titles: string[]) {
  const start = Date.now() - titles.length * 1000
  vi.useFakeTimers({ now: start, toFake: ['Date'] })
  try {
    for (const [i, title] of titles.entries()) {
      vi.setSystemTime(start + i * 1000)
      await add({ title })
    }
  }
  finally {
    vi.useRealTimers()
  }
}

/** The task titles shown in one group, in order. */
function titlesIn(group: string) {
  const section = screen.getByRole('region', { name: new RegExp(`^${group}`) })
  return within(section).getAllByRole('checkbox').map(box => box.getAttribute('aria-labelledby') && document.getElementById(box.getAttribute('aria-labelledby')!)!.textContent)
}

async function renderList() {
  const user = userEvent.setup()
  render(<TaskList />)
  await screen.findByRole('region', { name: /^No date/ })
  return user
}

describe('taskList', () => {
  it('shows the seeded samples in their date groups', async () => {
    await renderList()
    for (const group of ['Overdue', 'Today', 'Tomorrow', 'Upcoming', 'No date'])
      expect(screen.getByRole('region', { name: new RegExp(`^${group}`) })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /^Done/ })).not.toBeInTheDocument()
  })

  it('adds a task into the right group, clears the form and keeps focus there', async () => {
    const user = await renderList()
    const title = screen.getByLabelText('New task')
    await user.type(title, 'Call the bank')
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: today } })
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    await waitFor(() => expect(titlesIn('Today')[0]).toBe('Call the bank'))
    expect(title).toHaveValue('')
    expect(screen.getByLabelText('Due date')).toHaveValue('')
  })

  it('shows the length limit as an alert, keeps the draft, and saves nothing', async () => {
    await renderList()
    const title = screen.getByLabelText('New task')
    expect(title).toHaveAttribute('maxLength', String(MAX_TITLE_LENGTH))
    const tooLong = 'x'.repeat(MAX_TITLE_LENGTH + 1)
    // Set directly, the way a paste or autofill can, past maxLength.
    fireEvent.change(title, { target: { value: tooLong } })
    fireEvent.submit(title.closest('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent(`at most ${MAX_TITLE_LENGTH} characters`)
    expect(title).toHaveValue(tooLong)
    expect((await listTasks()).filter(t => t.isSample === 0)).toHaveLength(0)
  })

  it('shows a storage failure on add as an alert and keeps the draft', async () => {
    const user = await renderList()
    vi.spyOn(getDb().tasks, 'add').mockRejectedValueOnce(new DOMException('Quota exceeded', 'QuotaExceededError'))
    await user.type(screen.getByLabelText('New task'), 'Buy stamps')
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your text is still here')
    expect(screen.getByLabelText('New task')).toHaveValue('Buy stamps')
  })

  it('deletes with an undo toast, and Undo restores the task in place with focus on it', async () => {
    await addInOrder('First errand', 'Second errand', 'Third errand')
    const user = await renderList()
    const before = titlesIn('No date')
    expect(before.slice(0, 3)).toEqual(['Third errand', 'Second errand', 'First errand'])

    await user.click(screen.getByRole('button', { name: 'Delete "Second errand"' }))
    const status = screen.getByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('Deleted "Second errand"'))
    await waitFor(() => expect(titlesIn('No date')).not.toContain('Second errand'))

    await user.click(within(status).getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(titlesIn('No date')).toEqual(before))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Second errand' })).toHaveFocus())
    expect(status).toHaveTextContent('Restored "Second errand"')
  })

  it('moves focus to the next task in the group after a delete', async () => {
    await addInOrder('Older', 'Newer')
    const user = await renderList()

    await user.click(screen.getByRole('button', { name: 'Delete "Newer"' }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Older' })).toHaveFocus())
  })

  it('shows one toast and makes one tombstone for a double-click on Delete', async () => {
    const task = await add({ title: 'Clicked twice' })
    const user = await renderList()
    await user.dblClick(screen.getByRole('button', { name: 'Delete "Clicked twice"' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Deleted "Clicked twice"'))
    expect(within(screen.getByRole('status')).getAllByRole('button', { name: 'Undo' })).toHaveLength(1)
    // One delete bumps rev once: add made it 1, the delete makes it 2.
    expect((await getDb().tasks.get(task.id))?.rev).toBe(2)
  })

  it('clears the samples with one undo for all of them', async () => {
    await add({ title: 'Mine' })
    const user = await renderList()
    await user.click(screen.getByRole('button', { name: 'Clear sample tasks' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cleared 5 sample tasks'))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Clear sample tasks' })).not.toBeInTheDocument())
    expect(screen.getByLabelText('New task')).toHaveFocus()

    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Undo' }))
    await waitFor(async () => expect((await listTasks()).filter(t => t.isSample === 1)).toHaveLength(5))
  })

  it('keeps a delete after a reload', async () => {
    await add({ title: 'Pay rent' })
    const user = await renderList()
    await user.click(screen.getByRole('button', { name: 'Delete "Pay rent"' }))
    await waitFor(() => expect(screen.queryByText('Pay rent')).not.toBeInTheDocument())

    resetDbForTests()
    expect((await listTasks()).some(t => t.title === 'Pay rent')).toBe(false)
  })
})
