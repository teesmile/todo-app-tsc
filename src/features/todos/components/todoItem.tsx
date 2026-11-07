'use client'

import type { Todo } from '@/types/api'
import { Check, Edit2, X } from 'lucide-react'
import { useState } from 'react'
import { useUpdateTodo } from '../hooks/useTodos'

interface TodoItemProps {
  todo: Todo
  showActions?: boolean
}

function TodoItem({ todo, showActions = true }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(todo.todo)

  const updateTodoMutation = useUpdateTodo()

  const handleToggleComplete = () => {
    updateTodoMutation.mutate({
      id: todo.id,
      completed: !todo.completed,
    })
  }

  const handleSaveEdit = () => {
    if (!editText.trim())
      return

    updateTodoMutation.mutate({
      id: todo.id,
      todo: editText.trim(),
    })

    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditText(todo.todo)
    setIsEditing(false)
  }

  return (
    <div className="flex items-center gap-3 flex-1">
      {/* Completion Toggle */}
      <button
        type="button"
        onClick={handleToggleComplete}
        disabled={updateTodoMutation.isPending}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          todo.completed
            ? 'bg-orange-500 border-orange-500 text-white'
            : 'border-gray-300 hover:border-orange-400'
        }`}
      >
        {todo.completed && '✓'}
      </button>

      {/* Todo Text */}
      <div className="flex-1">
        {isEditing
          ? (
              <input
                type="text"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    handleSaveEdit()
                  if (e.key === 'Escape')
                    handleCancelEdit()
                }}
                autoFocus
              />
            )
          : (
              <span className={`block ${todo.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                {todo.todo}
              </span>
            )}
      </div>

      {/* Edit Actions */}
      {showActions && (
        <div className="flex items-center gap-2">
          {isEditing
            ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="p-1 text-orange-600 hover:text-orange-700"
                    disabled={updateTodoMutation.isPending}
                    title="Save changes"
                  >
                    <Check className="w-8 h-8" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="p-1 text-gray-600 hover:text-gray-700"
                    title="Cancel editing"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )
            : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="p-1 text-orange-600 hover:text-orange-700"
                    title="Edit todo"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </>
              )}
        </div>
      )}

      {/* Status Badge */}
      <div className="text-xs">
        {/* <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          todo.completed
            ? 'bg-green-100 text-green-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {todo.completed ? 'Done' : 'Pending'}
        </span> */}
      </div>
    </div>
  )
}

export default TodoItem
