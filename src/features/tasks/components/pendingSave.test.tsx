import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { add, update } from '../store/repository'
import { AddTaskForm } from './addTaskForm'
import { TaskItem } from './taskItem'

// The store calls are held open, so the user can keep typing while a save is
// in flight, which is the case these tests are about.
vi.mock('../store/repository', async importOriginal => ({
  ...(await importOriginal<typeof import('../store/repository')>()),
  add: vi.fn(),
  update: vi.fn(),
}))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<never>(r => (resolve = r as () => void))
  return { promise, resolve }
}

const task = {
  id: '0f8b6c2e-3d1a-4b7e-9c55-2a6d8e1f4b90',
  ownerId: 'guest',
  title: 'Buy oat milk',
  completed: false,
  dueDate: null,
  isSample: 0 as const,
  dirty: 0 as const,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  completedAt: null,
  deletedAt: null,
}

describe('typing while a save is in flight', () => {
  it('keeps the inline editor open with the newer text when a save finishes', async () => {
    const save = deferred()
    vi.mocked(update).mockReturnValueOnce(save.promise)
    const user = userEvent.setup()
    render(<TaskItem task={task} onDelete={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Edit "Buy oat milk"' }))
    const field = screen.getByRole('textbox')
    await user.type(field, ' and bread{Enter}')
    expect(update).toHaveBeenCalledWith(task.id, { title: 'Buy oat milk and bread' })

    // Still typing while the first save is in flight.
    await user.type(field, ' and eggs')
    await act(async () => save.resolve())

    expect(screen.getByRole('textbox')).toHaveValue('Buy oat milk and bread and eggs')
  })

  it('saves the newer text by itself if focus left the field during the save', async () => {
    const save = deferred()
    vi.mocked(update).mockReturnValueOnce(save.promise).mockResolvedValueOnce(task)
    const user = userEvent.setup()
    render(<TaskItem task={task} onDelete={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Edit "Buy oat milk"' }))
    await user.type(screen.getByRole('textbox'), ' and bread{Enter}')
    await user.type(screen.getByRole('textbox'), ' and eggs')
    await user.tab()
    await act(async () => save.resolve())

    expect(update).toHaveBeenLastCalledWith(task.id, { title: 'Buy oat milk and bread and eggs' })
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('keeps newer text in the add form when the earlier add finishes', async () => {
    const save = deferred()
    vi.mocked(add).mockReturnValueOnce(save.promise)
    const user = userEvent.setup()
    render(<AddTaskForm />)

    const field = screen.getByLabelText('New task')
    await user.type(field, 'Call the bank{Enter}')
    expect(add).toHaveBeenCalledWith({ title: 'Call the bank', dueDate: null })

    await user.type(field, ' about the card')
    await act(async () => save.resolve())

    expect(field).toHaveValue('Call the bank about the card')
  })
})
