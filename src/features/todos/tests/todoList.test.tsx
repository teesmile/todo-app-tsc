import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { todoService } from '@/services/todoService'
import { TodoList } from '../components/todoList'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}))

// A fresh QueryClient has an empty cache, so whatever renders after a
// remount was read back from IndexedDB, the same as after a page reload.
function mountList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TodoList />
    </QueryClientProvider>,
  )
}

describe('todoList delete', () => {
  beforeAll(() => {
    globalThis.indexedDB = new IDBFactory()
  })

  it('deletes a task from its row, and it stays deleted after a reload', async () => {
    await todoService.initialize()
    await todoService.createTodo({ todo: 'Pay rent' })
    await todoService.createTodo({ todo: 'Call the plumber' })
    const user = userEvent.setup()

    const first = mountList()
    await user.click(await screen.findByRole('button', { name: 'Delete "Pay rent"' }))
    await waitFor(() => expect(screen.queryByText('Pay rent')).not.toBeInTheDocument())
    expect(screen.getByText('Call the plumber')).toBeInTheDocument()
    first.unmount()

    mountList()
    expect(await screen.findByText('Call the plumber')).toBeInTheDocument()
    expect(screen.queryByText('Pay rent')).not.toBeInTheDocument()
  })
})
