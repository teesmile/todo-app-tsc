import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Each test gets an empty IndexedDB and a fresh copy of the service, so the
// singleton connection never leaks rows from one test into the next.
async function freshService() {
  globalThis.indexedDB = new IDBFactory()
  vi.resetModules()
  const { todoService } = await import('./todoService')
  await todoService.initialize()
  return todoService
}

describe('todoService concurrency', () => {
  let service: Awaited<ReturnType<typeof freshService>>

  beforeEach(async () => {
    service = await freshService()
  })

  it('never resurrects a task when an update races a delete', async () => {
    const { id } = await service.createTodo({ todo: 'Renew passport' })

    // Started together, the way two tabs (or a toggle and a delete) would be.
    await Promise.allSettled([
      service.updateTodo({ id, completed: true }),
      service.deleteTodo(id),
    ])

    expect(await service.getTodo(id)).toBeNull()
    expect((await service.getAllTodos()).todos).toHaveLength(0)
  })

  it('keeps both edits when two updates to different fields race', async () => {
    const { id } = await service.createTodo({ todo: 'Book dentist' })

    await Promise.all([
      service.updateTodo({ id, todo: 'Book dentist for Friday' }),
      service.updateTodo({ id, completed: true }),
    ])

    const stored = await service.getTodo(id)
    expect(stored).toMatchObject({ todo: 'Book dentist for Friday', completed: true })
  })

  it('refuses to update a task that has already been deleted', async () => {
    const { id } = await service.createTodo({ todo: 'Return library book' })
    await service.deleteTodo(id)

    await expect(service.updateTodo({ id, todo: 'edited after delete' })).rejects.toThrow('Todo not found')
    expect(await service.getTodo(id)).toBeNull()
  })
})
