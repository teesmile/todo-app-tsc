import { todoIndexedDB, TodoRecord } from '@/lib/indexedDB';

interface CreateTodoData {
  todo: string;
  completed?: boolean;
  userId?: number;
}

interface UpdateTodoData {
  id: number;
  todo?: string;
  completed?: boolean;
}

class TodoService {
  private baseURL = 'https://dummyjson.com';

  // Initialize and sync with API
  async initialize() {
    try {
      await todoIndexedDB.init();
      await this.syncFromAPI();
    } catch (error) {
      console.error('Failed to initialize TodoService:', error);
    }
  }

  // Get all todos from IndexedDB
  async getAllTodos() {
    const todos = await todoIndexedDB.getAllTodos();
    return {
      todos: todos.map(this.mapToTodoResponse),
      total: todos.length,
      skip: 0,
      limit: todos.length,
    };
  }

  // Get single todo
  async getTodo(id: number) {
    const todo = await todoIndexedDB.getTodo(id);
    return todo ? this.mapToTodoResponse(todo) : null;
  }

  // Create new todo (local-first)
  async createTodo(data: CreateTodoData) {
    const newTodo = await todoIndexedDB.saveTodo({
      ...data,
      isLocal: true,
      isSynced: false,
    });
    
    // Try to sync with API in background (optional)
    this.syncTodoToAPI(newTodo).catch(console.error);
    
    return this.mapToTodoResponse(newTodo);
  }

  // Update todo (local-first)
  async updateTodo(data: UpdateTodoData) {
    const existingTodo = await todoIndexedDB.getTodo(data.id);
    if (!existingTodo) {
      throw new Error('Todo not found');
    }

    const updatedTodo = await todoIndexedDB.saveTodo({
      ...existingTodo,
      ...data,
      isSynced: false, // Mark as unsynced after update
    });

    // Try to sync with API in background (optional)
    this.syncTodoToAPI(updatedTodo).catch(console.error);

    return this.mapToTodoResponse(updatedTodo);
  }

  // Delete todo (local-first)
  async deleteTodo(id: number) {
    await todoIndexedDB.deleteTodo(id);
    
    // Try to sync deletion with API in background (optional)
    this.deleteTodoFromAPI(id).catch(console.error);
  }

  // Sync with API (background process)
  private async syncFromAPI() {
    try {
      const response = await fetch(`${this.baseURL}/todos?limit=150`);
      const data = await response.json();
      
      await todoIndexedDB.syncFromAPI(data.todos);
      console.log('✅ Synced with API:', data.todos.length, 'todos');
    } catch (error) {
      console.error('❌ Failed to sync from API:', error);
    }
  }

  // Try to sync local todo to API (best effort)
  private async syncTodoToAPI(todo: TodoRecord) {
    try {
      const response = await fetch(`${this.baseURL}/todos/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todo: todo.todo,
          completed: todo.completed,
          userId: todo.userId,
        }),
      });

      if (response.ok) {
        // Mark as synced (note: dummy API doesn't actually persist)
        await todoIndexedDB.saveTodo({ ...todo, isSynced: true });
        console.log('✅ Todo synced to API:', todo.id);
      }
    } catch (error) {
      console.error('❌ Failed to sync todo to API:', error);
    }
  }

  // Try to delete from API (best effort)
  private async deleteTodoFromAPI(id: number) {
    try {
      const response = await fetch(`${this.baseURL}/todos/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        console.log('✅ Todo deleted from API:', id);
      }
    } catch (error) {
      console.error('❌ Failed to delete from API:', error);
    }
  }

  // Get sync status
  async getSyncStatus() {
    const unsynced = await todoIndexedDB.getUnsyncedTodos();
    const all = await todoIndexedDB.getAllTodos();
    
    return {
      total: all.length,
      unsynced: unsynced.length,
      synced: all.filter(t => t.isSynced).length,
      local: all.filter(t => t.isLocal).length,
    };
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
    };
  }
}

export const todoService = new TodoService();
export type { CreateTodoData, UpdateTodoData };