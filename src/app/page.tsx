'use client'

import { Suspense, useMemo } from 'react'
import { CreateTodo } from '@/features/todos/components/createTodo'
import { TodoList } from '@/features/todos/components/todoList'
import { useTodos } from '@/features/todos/hooks/useTodos'

export default function Home() {
  // Fetch todos for statistics
  const { data: todoData } = useTodos({ limit: 100, skip: 0 }) // Get more todos for stats

  // Calculate statistics
  const stats = useMemo(() => {
    if (!todoData?.todos) {
      return {
        completed: 0,
        inProgress: 0,
        completedPercentage: 0,
        inProgressPercentage: 0,
        totalTodos: 0,
        completedTodos: [],
        inProgressTodos: [],
      }
    }

    const todos = todoData.todos
    const totalTodos = todos.length
    const completedTodos = todos.filter(todo => todo.completed)
    const inProgressTodos = todos.filter(todo => !todo.completed)

    const completedCount = completedTodos.length
    const inProgressCount = inProgressTodos.length

    const completedPercentage = totalTodos > 0 ? Math.round((completedCount / totalTodos) * 100) : 0
    const inProgressPercentage = totalTodos > 0 ? Math.round((inProgressCount / totalTodos) * 100) : 0

    return {
      completed: completedCount,
      inProgress: inProgressCount,
      completedPercentage,
      inProgressPercentage,
      totalTodos,
      completedTodos: completedTodos.slice(0, 3), // Show only recent 3
      inProgressTodos,
    }
  }, [todoData])

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo */}
              <div className="flex items-center">
                <h1 className="text-2xl font-bold">
                  <span className="text-orange-500">Dash</span>
                  <span className="text-black">board</span>
                </h1>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <main>
            <div className="grid grid-cols-12 gap-6">
              {/* Todo List */}
              <div className="col-span-8">
                <div className="bg-white rounded-2xl shadow-sm border">
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">To-Do</h2>
                      <CreateTodo />
                    </div>
                  </div>
                  <div className="p-6">
                    <TodoList />
                  </div>
                </div>
              </div>

              {/* Right Sidebar - DYNAMIC */}
              <div className="col-span-4">
                {/* Task Status - Dynamic */}
                <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Status</h3>

                  {stats.totalTodos === 0
                    ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No tasks yet</p>
                          <p className="text-sm text-gray-400">Create your first task to see statistics</p>
                        </div>
                      )
                    : (
                        <div className="grid grid-cols-2 gap-4">
                          {/* Completed Circle */}
                          <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-2 relative">
                              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                                {/* Background circle */}
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="40"
                                  stroke="rgb(187 247 208)" // green-200
                                  strokeWidth="8"
                                  fill="transparent"
                                />
                                {/* Progress circle */}
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="40"
                                  stroke="rgb(34 197 94)" // green-500
                                  strokeWidth="8"
                                  fill="transparent"
                                  strokeDasharray={`${stats.completedPercentage * 2.51} 251.2`}
                                  strokeLinecap="round"
                                  className="transition-all duration-1000 ease-in-out"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-lg font-bold text-green-500">
                                  {stats.completedPercentage}
                                  %
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">
                              Completed
                            </p>
                          </div>

                          {/* In Progress Circle */}
                          <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-2 relative">
                              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                                {/* Background circle */}
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="40"
                                  stroke="rgb(254 215 170)" // orange-200
                                  strokeWidth="8"
                                  fill="transparent"
                                />
                                {/* Progress circle */}
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="40"
                                  stroke="rgb(249 115 22)" // orange-500
                                  strokeWidth="8"
                                  fill="transparent"
                                  strokeDasharray={`${stats.inProgressPercentage * 2.51} 251.2`}
                                  strokeLinecap="round"
                                  className="transition-all duration-1000 ease-in-out"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-lg font-bold text-orange-500">
                                  {stats.inProgressPercentage}
                                  %
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">
                              In Progress
                            </p>
                          </div>
                        </div>
                      )}
                </div>

                {/* Completed Tasks - Dynamic */}
                <div className="bg-white rounded-2xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Completed Tasks (
                    {stats.completed}
                    )
                  </h3>

                  {/* Dynamic completed tasks */}
                  <div className="space-y-3">
                    {stats.completedTodos.length === 0
                      ? (
                          <div className="text-center py-4">
                            <p className="text-gray-500 text-sm">No completed tasks yet</p>
                          </div>
                        )
                      : (
                          stats.completedTodos.map(todo => (
                            <div key={todo.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm">✓</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {todo.todo}
                                </p>
                                <p className="text-xs text-gray-500">Completed</p>
                              </div>
                            </div>
                          ))
                        )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </Suspense>
  )
}
