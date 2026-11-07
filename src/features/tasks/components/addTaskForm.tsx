'use client'

import type { Ref } from 'react'
import type { Task } from '../store/types'
import { useId, useRef, useState } from 'react'
import { useAction } from '../hooks/useAction'
import { saveErrorMessage } from '../lib/errors'
import { add, MAX_TITLE_LENGTH } from '../store/repository'
import { DueChooser } from './dueChooser'

interface AddTaskFormProps {
  titleRef?: Ref<HTMLInputElement>
  today: string
  /** The due date a new task gets unless one is chosen: today while the Today filter is on. */
  defaultDue?: string | null
  /** In the bottom sheet: Escape closes the sheet instead of just leaving the field. */
  autoFocus?: boolean
  /** `draftLeft` is true when more was typed while the add was in flight. */
  onAdded?: (task: Task, info: { draftLeft: boolean }) => void
}

/**
 * Adds a task: a title, with an optional due date behind a small Due chip.
 * The task records when it was added by itself. The chip shows the default
 * (Due today while the Today filter is on) so it's never a surprise. After a
 * save the form clears what was submitted and keeps focus; text typed while
 * the save was in flight is kept, and a failed save keeps the draft and says
 * why.
 */
export function AddTaskForm({ titleRef, today, defaultDue = null, autoFocus = false, onAdded }: AddTaskFormProps) {
  const id = useId()
  const [title, setTitle] = useState('')
  // The latest typed title, readable after the add's await.
  const titleNow = useRef('')
  // undefined: not chosen, so the default applies; null: chosen "No due date".
  const [chosenDue, setChosenDue] = useState<string | null | undefined>(undefined)
  const dueDate = chosenDue === undefined ? defaultDue : chosenDue
  const addTask = useAction(add)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const submitted = { title, chosenDue }
    try {
      const task = await addTask.run({ title, dueDate })
      // Clear only what was submitted: text typed while the add was in
      // flight is the next task, not something to throw away.
      const draftLeft = titleNow.current !== submitted.title
      if (!draftLeft)
        titleNow.current = ''
      setTitle(current => (current === submitted.title ? '' : current))
      setChosenDue(current => (current === submitted.chosenDue ? undefined : current))
      onAdded?.(task, { draftLeft })
    }
    catch {
      // Shown below; the draft stays.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor={`${id}-title`} className="block text-sm font-medium text-gray-700">New task</label>
      <div className="flex gap-2">
        <input
          ref={titleRef}
          id={`${id}-title`}
          type="text"
          value={title}
          onChange={(e) => {
            titleNow.current = e.target.value
            setTitle(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !autoFocus) {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          maxLength={MAX_TITLE_LENGTH}
          required
          aria-keyshortcuts="n"
          aria-invalid={Boolean(addTask.error)}
          aria-describedby={`${id}-hint${addTask.error ? ` ${id}-error` : ''}`}
          placeholder="What needs doing?"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          type="submit"
          disabled={addTask.pending || !title.trim()}
          className="min-h-11 shrink-0 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          Add task
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <DueChooser value={dueDate} onChange={setChosenDue} today={today} subject="the new task" />
        <p id={`${id}-hint`} className="text-xs text-gray-500">
          The due date is optional. Up to
          {' '}
          {MAX_TITLE_LENGTH}
          {' '}
          characters.
        </p>
      </div>
      {Boolean(addTask.error) && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-600">{saveErrorMessage(addTask.error)}</p>
      )}
    </form>
  )
}
