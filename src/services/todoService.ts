import type { TodoRecord } from '@/lib/indexedDB'
import { todoIndexedDB } from '@/lib/indexedDB'

interface CreateTodoData {
  todo: string
  completed?: boolean
  userId?: number
}

interface UpdateTodoData {
  id: number
  todo?: string
  completed?: boolean
}

class TodoService {
  // Open the local database. Nothing is fetched: IndexedDB is the only store.
  async initialize() {
    try {
      await todoIndexedDB.init()
    }
    catch (error) {
      console.error('Failed to initialize TodoService:', error)
    }
  }

  // Get all todos from IndexedDB
  async getAllTodos() {
    const todos = await todoIndexedDB.getAllTodos()
    return {
      todos: todos.map(this.mapToTodoResponse),
      total: todos.length,
      skip: 0,
      limit: todos.length,
    }
  }

  // Get single todo
  async getTodo(id: number) {
    const todo = await todoIndexedDB.getTodo(id)
    return todo ? this.mapToTodoResponse(todo) : null
  }

  // Create new todo (local-first)
  async createTodo(data: CreateTodoData) {
    const newTodo = await todoIndexedDB.saveTodo({
      ...data,
      isLocal: true,
      isSynced: false,
    })

    return this.mapToTodoResponse(newTodo)
  }

  // Update todo (local-first)
  async updateTodo({ id, ...patch }: UpdateTodoData) {
    const updatedTodo = await todoIndexedDB.updateTodo(id, patch)
    return this.mapToTodoResponse(updatedTodo)
  }

  // Delete todo (local-first)
  async deleteTodo(id: number) {
    await todoIndexedDB.deleteTodo(id)
  }

  // Get sync status
  async getSyncStatus() {
    const unsynced = await todoIndexedDB.getUnsyncedTodos()
    const all = await todoIndexedDB.getAllTodos()

    return {
      total: all.length,
      unsynced: unsynced.length,
      synced: all.filter(t => t.isSynced).length,
      local: all.filter(t => t.isLocal).length,
    }
  }

  // Helper to map database record to API response format
  private mapToTodoResponse(record: TodoRecord) {
    return {
      id: record.id,
      todo: record.todo,
      completed: record.completed,
      userId: record.userId,
      // Add sync metadata
      _meta: {
        isLocal: record.isLocal,
        isSynced: record.isSynced,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    }
  }
}

export const todoService = new TodoService()
export type { CreateTodoData, UpdateTodoData }
