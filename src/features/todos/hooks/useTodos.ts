import type { CreateTodoData, UpdateTodoData } from '@/services/todoService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { todoService } from '@/services/todoService'

// ... Updated hooks implementation (from previous response)

// Initialize service when hook is first used
let isInitialized = false
async function initializeService() {
  if (!isInitialized) {
    await todoService.initialize()
    isInitialized = true
  }
}

export function useTodos({ limit = 10, skip = 0 } = {}) {
  return useQuery({
    queryKey: ['todos', { limit, skip }],
    queryFn: async () => {
      await initializeService()
      const result = await todoService.getAllTodos()

      // Apply pagination client-side
      const start = skip
      const end = start + limit
      const paginatedTodos = result.todos.slice(start, end)

      return {
        ...result,
        todos: paginatedTodos,
        skip,
        limit,
      }
    },
  })
}

export function useTodo(id: number) {
  return useQuery({
    queryKey: ['todo', id],
    queryFn: async () => {
      await initializeService()
      return todoService.getTodo(id)
    },
    enabled: !!id,
  })
}

export function useAddTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateTodoData) => {
      await initializeService()
      return todoService.createTodo(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}

export function useUpdateTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateTodoData) => {
      await initializeService()
      return todoService.updateTodo(data)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      queryClient.invalidateQueries({ queryKey: ['todo', data.id] })
    },
  })
}

export function useDeleteTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      await initializeService()
      return todoService.deleteTodo(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      await initializeService()
      return todoService.getSyncStatus()
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}
