import type { Task } from '@/features/tasks/store/types'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TodoItem from '../components/todoItem'

// Characterization test: it pins how today's TodoItem behaves so the test
// setup is proven before Phase 4 replaces the component. The store's update()
// is mocked at the module boundary, so the test checks exactly what the
// component asks the store to do.
const { update } = vi.hoisted(() => ({ update: vi.fn(async () => ({})) }))
vi.mock('@/features/tasks/store/repository', () => ({ update }))

const ID = '0f8b6c2e-3d1a-4b7e-9c55-2a6d8e1f4b90'
function makeTodo(overrides: Partial<Task> = {}): Task {
  return {
    id: ID,
    ownerId: 'guest',
    title: 'Buy oat milk',
    completed: false,
    dueDate: null,
    isSample: 0,
    dirty: 0,
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    completedAt: null,
    deletedAt: null,
    ...overrides,
  }
}

describe('todoItem', () => {
  beforeEach(() => {
    update.mockClear()
  })

  it('renders the todo text as plain text, with no link to the removed detail page', () => {
    render(<TodoItem todo={makeTodo()} showActions={false} />)

    expect(screen.getByText('Buy oat milk')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('strikes through a completed todo and leaves an active one plain', () => {
    const { rerender } = render(<TodoItem todo={makeTodo({ completed: true })} showActions={false} />)
    expect(screen.getByText('Buy oat milk')).toHaveClass('line-through')

    rerender(<TodoItem todo={makeTodo({ completed: false })} showActions={false} />)
    expect(screen.getByText('Buy oat milk')).not.toHaveClass('line-through')
  })

  it('asks the store to flip completion when the toggle is clicked', async () => {
    const user = userEvent.setup()
    render(<TodoItem todo={makeTodo({ completed: false })} showActions={false} />)

    // The toggle has no accessible name yet (audit 3.4), so it's found as the
    // only button in the row. Phase 4 replaces it with a labelled checkbox.
    await user.click(screen.getByRole('button'))

    expect(update).toHaveBeenCalledExactlyOnceWith(ID, { completed: true })
  })

  it('saves an edit on Enter (the store trims it)', async () => {
    const user = userEvent.setup()
    render(<TodoItem todo={makeTodo()} />)

    await user.click(screen.getByTitle('Edit todo'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '  Buy oat milk and bread  {Enter}')

    expect(update).toHaveBeenCalledExactlyOnceWith(ID, { title: '  Buy oat milk and bread  ' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
