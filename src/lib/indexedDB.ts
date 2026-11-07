interface TodoRecord {
  id: number
  todo: string
  completed: boolean
  userId: number
  isLocal: boolean
  isSynced: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

/**
 * Settles when a readwrite transaction finishes. A write isn't durable until
 * `complete` fires: a request can succeed and its transaction still abort
 * (quota, or an explicit abort), rolling the write back with no request error.
 * Resolving on the request's success would report a write that never landed,
 * and listening only for `complete` and `error` would hang on an abort.
 */
function settle<T>(transaction: IDBTransaction, value: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(value())
    transaction.onabort = () => reject(transaction.error ?? new DOMException('Transaction aborted', 'AbortError'))
    transaction.onerror = () => reject(transaction.error)
  })
}

class TodoIndexedDB {
  private dbName = 'TodoAppDB'
  private version = 1
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains('todos')) {
          const store = db.createObjectStore('todos', { keyPath: 'id' })
          store.createIndex('isLocal', 'isLocal', { unique: false })
          store.createIndex('isSynced', 'isSynced', { unique: false })
          store.createIndex('userId', 'userId', { unique: false })
        }
      }
    })
  }

  private async ensureConnection() {
    if (!this.db) {
      await this.init()
    }
  }

  async getAllTodos(): Promise<TodoRecord[]> {
    await this.ensureConnection()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['todos'], 'readonly')
      const store = transaction.objectStore('todos')
      const request = store.getAll()

      request.onsuccess = () => {
        const todos = request.result.filter(todo => !todo.deletedAt)
        resolve(todos)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getTodo(id: number): Promise<TodoRecord | null> {
    await this.ensureConnection()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['todos'], 'readonly')
      const store = transaction.objectStore('todos')
      const request = store.get(id)

      request.onsuccess = () => {
        const todo = request.result
        resolve(todo && !todo.deletedAt ? todo : null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async saveTodo(todo: Partial<TodoRecord>): Promise<TodoRecord> {
    await this.ensureConnection()
    const now = new Date()

    const todoRecord: TodoRecord = {
      id: todo.id || Date.now(), // Generate ID if not provided
      todo: todo.todo || '',
      completed: todo.completed || false,
      userId: todo.userId || 1,
      isLocal: todo.isLocal ?? true,
      isSynced: todo.isSynced ?? false,
      createdAt: todo.createdAt || now,
      updatedAt: now,
    }

    const transaction = this.db!.transaction(['todos'], 'readwrite')
    transaction.objectStore('todos').put(todoRecord)
    return settle(transaction, () => todoRecord)
  }

  /**
   * Applies `patch` to the stored row inside one readwrite transaction.
   * Reading and writing in separate transactions let a delete or another
   * edit commit in between, which the write then overwrote: the deleted row
   * came back (it was rebuilt without `deletedAt`) or the other edit was lost.
   * IndexedDB serialises overlapping readwrite transactions, so nothing can
   * land between this read and this write. Resolves once the write commits.
   */
  async updateTodo(id: number, patch: Partial<Pick<TodoRecord, 'todo' | 'completed'>>): Promise<TodoRecord> {
    await this.ensureConnection()
    const transaction = this.db!.transaction(['todos'], 'readwrite')
    const store = transaction.objectStore('todos')
    let updated: TodoRecord | undefined
    let missing = false
    const committed = settle(transaction, () => updated!)

    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      const current: TodoRecord | undefined = getRequest.result
      if (!current || current.deletedAt) {
        missing = true
        transaction.abort()
        return
      }
      // Drop undefined keys so `{ todo: undefined }` can't wipe the title.
      const changes = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined))
      updated = { ...current, ...changes, isSynced: false, updatedAt: new Date() }
      store.put(updated)
    }

    return committed.catch((error) => {
      throw missing ? new Error('Todo not found') : error
    })
  }

  async deleteTodo(id: number): Promise<void> {
    await this.ensureConnection()
    const transaction = this.db!.transaction(['todos'], 'readwrite')
    const store = transaction.objectStore('todos')

    // Soft delete: mark as deleted instead of removing.
    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      const todo = getRequest.result
      if (todo) {
        todo.deletedAt = new Date()
        todo.updatedAt = new Date()
        store.put(todo)
      }
    }
    return settle(transaction, () => undefined)
  }

  async getUnsyncedTodos(): Promise<TodoRecord[]> {
    await this.ensureConnection()
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['todos'], 'readonly')
      const store = transaction.objectStore('todos')
      const index = store.index('isSynced')
      const request = index.getAll(IDBKeyRange.only(false))

      request.onsuccess = () => {
        const unsynced = request.result.filter(todo => !todo.deletedAt)
        resolve(unsynced)
      }
      request.onerror = () => reject(request.error)
    })
  }
}

export const todoIndexedDB = new TodoIndexedDB()
export type { TodoRecord }
