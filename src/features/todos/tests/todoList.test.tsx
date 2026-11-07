import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { resetDbForTests } from '@/features/tasks/store/db'
import { add } from '@/features/tasks/store/repository'
import { TodoList } from '../components/todoList'

/* eslint-disable react-hooks-extra/no-unnecessary-use-prefix -- the keys must match next/navigation's exports */
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}))
/* eslint-enable react-hooks-extra/no-unnecessary-use-prefix */

describe('todoList', () => {
  it('shows a task added to the store without any refresh (live query)', async () => {
    render(<TodoList />)
    expect(await screen.findByText('Try editing or deleting these sample tasks')).toBeInTheDocument()

    await add({ title: 'Added straight to the store' })
    expect(await screen.findByText('Added straight to the store')).toBeInTheDocument()
  })

  it('deletes a task from its row, and it stays deleted after a reload', async () => {
    await add({ title: 'Pay rent' })
    await add({ title: 'Call the plumber' })
    const user = userEvent.setup()

    const first = render(<TodoList />)
    await user.click(await screen.findByRole('button', { name: 'Delete "Pay rent"' }))
    await waitFor(() => expect(screen.queryByText('Pay rent')).not.toBeInTheDocument())
    expect(screen.getByText('Call the plumber')).toBeInTheDocument()
    first.unmount()

    // A reload: drop the connection, then mount again and read from IndexedDB.
    resetDbForTests()
    render(<TodoList />)
    expect(await screen.findByText('Call the plumber')).toBeInTheDocument()
    expect(screen.queryByText('Pay rent')).not.toBeInTheDocument()
  })
})
