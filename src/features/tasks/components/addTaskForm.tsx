'use client'

import type { Ref } from 'react'
import { useId, useState } from 'react'
import { useAction } from '../hooks/useAction'
import { saveErrorMessage } from '../lib/errors'
import { add, MAX_TITLE_LENGTH } from '../store/repository'

/**
 * A single-line add form: a title and an optional due date. After a save it
 * clears and keeps focus in the title field, so tasks can be added one after
 * another. A failed save keeps the draft and says why.
 */
export function AddTaskForm({ titleRef }: { titleRef?: Ref<HTMLInputElement> }) {
  const id = useId()
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const addTask = useAction(add)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const submitted = { title, dueDate }
    try {
      await addTask.run({ title, dueDate: dueDate || null })
      // Clear only what was submitted: text typed while the add was in
      // flight is the next task, not something to throw away.
      setTitle(current => (current === submitted.title ? '' : current))
      setDueDate(current => (current === submitted.dueDate ? '' : current))
    }
    catch {
      // Shown below; the draft stays.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-title`} className="mb-1 block text-sm font-medium text-gray-700">New task</label>
          <input
            ref={titleRef}
            id={`${id}-title`}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={MAX_TITLE_LENGTH}
            required
            aria-invalid={Boolean(addTask.error)}
            aria-describedby={`${id}-hint${addTask.error ? ` ${id}-error` : ''}`}
            placeholder="What needs doing?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label htmlFor={`${id}-due`} className="mb-1 block text-sm font-medium text-gray-700">Due date</label>
          <input
            id={`${id}-due`}
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-gray-700"
          />
        </div>
        <button
          type="submit"
          disabled={addTask.pending || !title.trim()}
          className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          Add task
        </button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-gray-500">
        Up to
        {' '}
        {MAX_TITLE_LENGTH}
        {' '}
        characters. The due date is optional.
      </p>
      {Boolean(addTask.error) && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600">{saveErrorMessage(addTask.error)}</p>
      )}
    </form>
  )
}
