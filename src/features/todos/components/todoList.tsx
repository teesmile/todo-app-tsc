'use client'

import { Edit2, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useAction } from '@/features/tasks/hooks/useAction'
import { useTasks } from '@/features/tasks/store/hooks'
import { remove } from '@/features/tasks/store/repository'
import { CreateTodo } from './createTodo'

import { EditTodoForm } from './editTodoForm'
// Import your modular components
import TodoItem from './todoItem'

export function TodoList() {
  const [editingTodo, setEditingTodo] = useState<string | null>(null)

  const tasks = useTasks()
  const deleteTask = useAction(remove)

  // Dynamic date generation
  const getCurrentDate = () => {
    const today = new Date()
    const day = today.getDate()
    const month = today.toLocaleDateString('en-US', { month: 'long' })
    return `${day} ${month}`
  }

  const getTodayLabel = () => {
    const today = new Date()
    const currentDate = new Date()

    // Check if it's actually today
    if (today.toDateString() === currentDate.toDateString()) {
      return 'Today'
    }

    // You could also add logic for Yesterday, Tomorrow, etc.
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    if (today.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (today.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    }

    return today.toLocaleDateString('en-US', { weekday: 'long' })
  }

  if (tasks === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-16 w-16 animate-spin text-orange-500" />
      </div>
    )
  }

  // Every task, no pagination (review 5). Deleting the last row on a
  // later page used to strand the list; a local task list doesn't need pages.
  const todos = tasks

  if (!todos.length) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">No todos found</p>
        <CreateTodo />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Date Header */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
        <span>{getCurrentDate()}</span>
        <span className="text-orange-500 !important">{getTodayLabel()}</span>
      </div>

      {Boolean(deleteTask.error) && (
        <p role="alert" className="text-sm text-red-600">
          That task couldn't be deleted. Try again.
        </p>
      )}

      {/* Todo Items */}
      <div className="space-y-3">
        {todos.map(todo => (
          <div key={todo.id} className="group">
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              {/* Priority Dot */}
              <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                todo.completed ? 'bg-gray-300' : 'bg-orange-400'
              }`}
              />

              {/* Todo Content */}
              <div className="flex-1 min-w-0">

                {editingTodo === todo.id
                  ? (
                      <EditTodoForm
                        todo={todo}
                        onSave={() => setEditingTodo(null)}
                        onCancel={() => setEditingTodo(null)}
                      />
                    )
                  : (
                      <TodoItem todo={todo} showActions={false} />
                    )}

                {/* Task Details */}
                {editingTodo !== todo.id && (
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span className={`px-2 py-1 rounded-full ${
                      todo.completed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}
                    >
                      {todo.completed ? 'Completed' : 'In Progress'}
                    </span>
                    <span>Priority: Moderate</span>
                    <span>
                      Status:
                      {' '}
                      {todo.completed ? 'Completed' : 'Not Started'}
                    </span>
                    {/* Action Buttons */}
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        className="p-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded"
                        title="Edit todo"
                        onClick={() => {
                        // Toggle edit mode for this specific todo
                          setEditingTodo(editingTodo === todo.id ? null : todo.id)
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                        aria-label={`Delete "${todo.title}"`}
                        title="Delete todo"
                        disabled={deleteTask.pending}
                        onClick={() => deleteTask.fire(todo.id)}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                )}
              </div>

              {/* Task Image/Icon */}
              <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-500 rounded-lg flex-shrink-0 flex items-center justify-center">
                <span className="text-white text-xs font-medium">{todo.id}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
