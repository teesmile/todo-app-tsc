'use client'

import type { Task } from '@/features/tasks/store/types'
import { Check, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useAction } from '@/features/tasks/hooks/useAction'
import { saveErrorMessage } from '@/features/tasks/lib/errors'
import { MAX_TITLE_LENGTH, update } from '@/features/tasks/store/repository'

interface EditTodoFormProps {
  todo: Task
  onSave: () => void
  onCancel: () => void
}

export function EditTodoForm({ todo, onSave, onCancel }: EditTodoFormProps) {
  const [editText, setEditText] = useState(todo.title)
  const updateTask = useAction(update)
  const errorId = useId()
  // An imported title may already be longer than the limit; it can be kept or
  // shortened, never grown (the store enforces the same rule).
  const maxLength = Math.max(MAX_TITLE_LENGTH, todo.title.length)

  const handleSave = async () => {
    if (!editText.trim())
      return

    try {
      await updateTask.run(todo.id, { title: editText })
      onSave()
    }
    catch {
      // Shown below via updateTask.error; the draft stays in the field.
    }
  }

  const handleCancel = () => {
    setEditText(todo.title)
    onCancel()
  }

  return (
    <div className="mb-2">
      <textarea
        aria-label={`Edit "${todo.title}"`}
        aria-invalid={Boolean(updateTask.error)}
        aria-describedby={updateTask.error ? errorId : undefined}
        maxLength={maxLength}
        value={editText}
        onChange={e => setEditText(e.target.value)}
        className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
        rows={2}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSave()
          }
          if (e.key === 'Escape') {
            handleCancel()
          }
        }}
      />
      {Boolean(updateTask.error) && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">{saveErrorMessage(updateTask.error)}</p>
      )}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1 px-3 py-1 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 disabled:opacity-50"
          disabled={updateTask.pending || !editText.trim()}
        >
          <Check className="w-3 h-3" />
          {updateTask.pending ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-1 px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400"
        >
          <X className="w-3 h-3 text-orange-500" />
          Cancel
        </button>
      </div>
    </div>
  )
}
