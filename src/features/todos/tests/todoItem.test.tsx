import type { Todo } from '@/types/api'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TodoItem from '../components/todoItem'

// Characterization test: it pins how today's TodoItem behaves so the test
// setup is proven before Phase 4 replaces the component. The mutation hook is
// mocked at the module boundary because the real one reaches IndexedDB.
const mutate = vi.fn()
vi.mock('../hooks/useTodos', () => ({
  // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix -- the key must match the real hook's export name
  useUpdateTodo: () => ({ mutate, isPending: false }),
}))

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return { id: 7, todo: 'Buy oat milk', completed: false, userId: 1, ...overrides }
}

describe('todoItem', () => {
  beforeEach(() => {
    mutate.mockClear()
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

  it('asks the update mutation to flip completion when the toggle is clicked', async () => {
    const user = userEvent.setup()
    render(<TodoItem todo={makeTodo({ completed: false })} showActions={false} />)

    // The toggle has no accessible name yet (audit 3.4), so it's found as the
    // only button in the row. Phase 4 replaces it with a labelled checkbox.
    await user.click(screen.getByRole('button'))

    expect(mutate).toHaveBeenCalledExactlyOnceWith({ id: 7, completed: true })
  })

  it('saves a trimmed edit on Enter', async () => {
    const user = userEvent.setup()
    render(<TodoItem todo={makeTodo()} />)

    await user.click(screen.getByTitle('Edit todo'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '  Buy oat milk and bread  {Enter}')

    expect(mutate).toHaveBeenCalledExactlyOnceWith({ id: 7, todo: 'Buy oat milk and bread' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
