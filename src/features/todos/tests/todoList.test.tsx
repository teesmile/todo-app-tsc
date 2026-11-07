import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { resetDbForTests } from '@/features/tasks/store/db'
import { add } from '@/features/tasks/store/repository'
import { TodoList } from '../components/todoList'

describe('todoList', () => {
  it('shows a task added to the store without any refresh (live query)', async () => {
    render(<TodoList />)
    expect(await screen.findByText('Try editing or deleting these sample tasks')).toBeInTheDocument()

    await add({ title: 'Added straight to the store' })
    expect(await screen.findByText('Added straight to the store')).toBeInTheDocument()
  })

  it('shows every task with no pagination, and deleting the last one leaves the rest', async () => {
    for (let i = 1; i <= 11; i++)
      await add({ title: `Errand ${i}` })
    const user = userEvent.setup()
    render(<TodoList />)

    // 11 added plus 5 samples, all on one list: no page 2 to strand.
    expect(await screen.findByText('Errand 11')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Delete "/ })).toHaveLength(16)
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete "Errand 1"' }))
    await waitFor(() => expect(screen.queryByText('Errand 1')).not.toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: /^Delete "/ })).toHaveLength(15)
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
