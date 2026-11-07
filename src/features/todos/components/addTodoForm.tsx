'use client'

import { useId, useState } from 'react'
import { useAction } from '@/features/tasks/hooks/useAction'
import { saveErrorMessage } from '@/features/tasks/lib/errors'
import { add, MAX_TITLE_LENGTH } from '@/features/tasks/store/repository'

interface AddTodoFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function AddTodoForm({ onSuccess, onCancel }: AddTodoFormProps) {
  const [todo, setTodo] = useState('')
  const [completed, setCompleted] = useState(false)

  const addTask = useAction(add)
  const fieldId = useId()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!todo.trim())
      return

    addTask.run({ title: todo, completed })
      .then(() => {
        setTodo('')
        setCompleted(false)
        onSuccess?.()
      })
      .catch(() => {})
  }

  const handleCancel = () => {
    setTodo('')
    setCompleted(false)
    onCancel?.()
  }

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <div className="mb-6">
        <label htmlFor={`${fieldId}-title`} className="block text-sm font-medium text-gray-700 mb-2">
          Todo Description
        </label>
        <textarea
          id={`${fieldId}-title`}
          aria-describedby={`${fieldId}-hint`}
          aria-invalid={Boolean(addTask.error)}
          maxLength={MAX_TITLE_LENGTH}
          value={todo}
          onChange={e => setTodo(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          rows={3}
          placeholder="Enter your todo description..."
          required
          autoFocus
        />
        <p id={`${fieldId}-hint`} className="mt-1 text-xs text-gray-500">
          Up to
          {' '}
          {MAX_TITLE_LENGTH}
          {' '}
          characters.
        </p>
        {Boolean(addTask.error) && (
          <p role="alert" className="mt-2 text-sm text-red-600">{saveErrorMessage(addTask.error)}</p>
        )}
      </div>

      <div className="mb-6">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={completed}
            onChange={e => setCompleted(e.target.checked)}
            className="w-4 h-4 text-white bg-orange-500 border-none rounded focus:ring-orange-500 accent-orange-500"
          />
          <span className="text-sm text-gray-700">Mark as completed</span>
        </label>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          disabled={addTask.pending}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
          disabled={addTask.pending || !todo.trim()}
        >
          {addTask.pending ? 'Creating...' : 'Create Todo'}
        </button>
      </div>
    </form>
  )
}
