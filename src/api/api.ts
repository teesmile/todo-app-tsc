import type { AddTodoPayload, LoginCredentials, Todo, TodosResponse, User } from '@/types/api'
import { api } from './api-client'

// Todo Api
export async function fetchTodos(params: { limit: number, skip: number }): Promise<TodosResponse> {
  return api.get('/todos', { params })
}
export async function fetchTodo(todoId: number): Promise<Todo> {
  return api.get(`/todos/${todoId}`)
}

export async function addTodo(newTodo: AddTodoPayload): Promise<Todo> {
  return api.post('/todos/add', newTodo)
}

export async function updateTodo(todoId: number, updatedTodo: Partial<AddTodoPayload>): Promise<TodosResponse> {
  return api.put(`/todos/${todoId}`, updatedTodo)
}

export async function deleteTodo(todoId: number): Promise<AddTodoPayload> {
  return api.delete(`/todos/${todoId}`)
}

// Auth Api
export async function login(credentials: LoginCredentials): Promise<User> {
  return api.post('/auth/login', credentials)
}
