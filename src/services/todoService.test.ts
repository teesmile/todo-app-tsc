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

  it('rejects, and leaves the row unchanged, when the update transaction aborts after its write', async () => {
    const { id } = await service.createTodo({ todo: 'Water the plants' })

    // Abort the transaction right after put() succeeds. That's what a quota or
    // commit failure looks like: no request error, only an abort and a rollback.
    const { IDBObjectStore } = await import('fake-indexeddb')
    const realPut = IDBObjectStore.prototype.put
    const putSpy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      const request = realPut.apply(this, args)
      request.addEventListener('success', () => this.transaction.abort())
      return request
    })

    try {
      const outcome = await Promise.race([
        service.updateTodo({ id, todo: 'never committed' }).then(() => 'resolved', () => 'rejected'),
        new Promise(resolve => setTimeout(resolve, 500, 'hung')),
      ])
      expect(outcome).toBe('rejected')
    }
    finally {
      putSpy.mockRestore()
    }
    expect(await service.getTodo(id)).toMatchObject({ todo: 'Water the plants' })
  })

  it('refuses to update a task that has already been deleted', async () => {
    const { id } = await service.createTodo({ todo: 'Return library book' })
    await service.deleteTodo(id)

    await expect(service.updateTodo({ id, todo: 'edited after delete' })).rejects.toThrow('Todo not found')
    expect(await service.getTodo(id)).toBeNull()
  })
})
