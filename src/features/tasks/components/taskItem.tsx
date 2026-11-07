'use client'

import type { Task } from '../store/types'
import { Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useAction } from '../hooks/useAction'
import { saveErrorMessage } from '../lib/errors'
import { MAX_TITLE_LENGTH, update } from '../store/repository'

interface TaskItemProps {
  task: Task
  onDelete: (task: Task) => void
}

/**
 * One task row:
 * - a real checkbox, labelled by the title, to complete it;
 * - the title as a button that turns into an input (Enter or blur saves,
 *   Escape cancels);
 * - a native date input for the due date;
 * - a Delete button.
 * A failed save shows the error here and keeps the draft.
 */
export function TaskItem({ task, onDelete }: TaskItemProps) {
  const titleId = useId()
  const errorId = useId()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.title)
  // The latest typed text, readable after an await without a stale closure.
  const draftRef = useRef(task.title)
  const saveTitle = useAction(update)
  const toggle = useAction(update)
  const setDue = useAction(update)

  const inputRef = useRef<HTMLInputElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  // Escape must stop the blur that follows it from saving, and Enter must
  // stop that blur from saving a second time.
  const settled = useRef(false)
  const wasEditing = useRef(false)

  useEffect(() => {
    if (editing)
      inputRef.current?.focus()
    else if (wasEditing.current)
      editButtonRef.current?.focus()
    wasEditing.current = editing
  }, [editing])

  function changeDraft(value: string) {
    draftRef.current = value
    setDraft(value)
  }

  function startEditing() {
    settled.current = false
    changeDraft(task.title)
    setEditing(true)
  }

  async function commit() {
    if (settled.current)
      return
    if (draftRef.current.trim() === task.title) {
      settled.current = true
      setEditing(false)
      return
    }
    settled.current = true
    const submitted = draftRef.current
    try {
      await saveTitle.run(task.id, { title: submitted })
      if (draftRef.current !== submitted) {
        // More was typed while that save was in flight (found in place of
        // Phase 4's review). Keep it: stay open, or save it straight
        // away if focus has already left the field.
        settled.current = false
        if (document.activeElement !== inputRef.current)
          commit()
        return
      }
      setEditing(false)
    }
    catch {
      // Shown below; stay in the field with the draft so nothing is lost.
      settled.current = false
    }
  }

  function cancel() {
    settled.current = true
    changeDraft(task.title)
    setEditing(false)
  }

  const error = saveTitle.error ?? toggle.error ?? setDue.error

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 p-3 hover:bg-gray-100">
      {/* The checkbox's name is the title, from this always-present span. */}
      <span id={titleId} className="sr-only">{task.title}</span>
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => toggle.fire(task.id, { completed: !task.completed })}
        aria-labelledby={titleId}
        data-task-id={task.id}
        className="h-5 w-5 shrink-0 accent-orange-500"
      />

      <div className="min-w-0 flex-1">
        {editing
          ? (
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={e => changeDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commit()
                  }
                  else if (e.key === 'Escape') {
                    e.preventDefault()
                    cancel()
                  }
                }}
                onBlur={() => commit()}
                maxLength={Math.max(MAX_TITLE_LENGTH, task.title.length)}
                aria-label={`Edit "${task.title}"`}
                aria-invalid={Boolean(saveTitle.error)}
                aria-describedby={error ? errorId : undefined}
                className="w-full rounded border border-orange-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            )
          : (
              <button
                ref={editButtonRef}
                type="button"
                onClick={startEditing}
                aria-label={`Edit "${task.title}"`}
                className={`block w-full break-words rounded text-left hover:text-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}
              >
                {task.title}
              </button>
            )}
        {Boolean(error) && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">{saveErrorMessage(error)}</p>
        )}
      </div>

      {/* Remounts when the stored date changes, so it always shows the saved value. */}
      <input
        key={task.dueDate ?? 'none'}
        type="date"
        defaultValue={task.dueDate ?? ''}
        onChange={e => setDue.fire(task.id, { dueDate: e.target.value || null })}
        aria-label={`Due date for "${task.title}"`}
        className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700"
      />

      <button
        type="button"
        onClick={() => onDelete(task)}
        aria-label={`Delete "${task.title}"`}
        className="rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
