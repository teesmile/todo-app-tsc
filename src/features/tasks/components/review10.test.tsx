import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dexie from 'dexie'
import { describe, expect, it, vi } from 'vitest'
import { screenSize } from '@/test/screen'
import { getDb } from '../store/db'
import { listTasks } from '../store/repository'
import { TaskList } from './taskList'

// Regression test for the finding of review 10.

/** Holds the next `add` on tasks open inside its transaction until released. */
function holdNextAdd() {
  let release!: () => void
  const gate = new Promise<void>(r => (release = r))
  const t = getDb().tasks
  const real = t.add.bind(t) as (...args: unknown[]) => Promise<unknown>
  vi.spyOn(t, 'add').mockImplementationOnce(((...args: unknown[]) => Dexie.waitFor(gate).then(() => real(...args))) as never)
  return () => act(async () => {
    release()
    await new Promise(r => setTimeout(r, 50))
  })
}

describe('a save from an earlier sheet opening never closes the current one', () => {
  it('keeps a draft typed after closing and reopening the sheet while the first add was saving', async () => {
    screenSize.desktop = false
    const user = userEvent.setup()
    render(<TaskList />)
    await waitFor(() => expect(screen.queryByText('Loading tasks')).not.toBeInTheDocument())
    const fab = screen.getByRole('button', { name: 'Add a task' })
    const sheet = () => screen.getByRole('dialog', { name: 'Add a task' })

    const release = holdNextAdd()
    await user.click(fab)
    await user.type(within(sheet()).getByLabelText('New task'), 'Task A{Enter}')
    await user.click(within(sheet()).getByRole('button', { name: 'Close' }))
    await user.click(fab)
    await user.type(within(sheet()).getByLabelText('New task'), 'Task B')

    await release()

    expect(sheet()).toHaveAttribute('open')
    expect(within(sheet()).getByLabelText('New task')).toHaveValue('Task B')
    expect((await listTasks()).map(t => t.title)).toContain('Task A')
    expect(screen.getByRole('status')).toHaveTextContent('Added "Task A"')
  })
})
