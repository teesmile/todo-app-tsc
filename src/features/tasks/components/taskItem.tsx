'use client'

import type { Task } from '../store/types'
import { Star, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useAction } from '../hooks/useAction'
import { formatAdded } from '../lib/dates'
import { saveErrorMessage } from '../lib/errors'
import { MAX_TITLE_LENGTH, TitleConflictError, update } from '../store/repository'
import { DueChooser } from './dueChooser'
import { useEditDrafts } from './editDrafts'
import { LabelChips, LabelChooser } from './labelChooser'

interface TaskItemProps {
  task: Task
  onDelete: (task: Task) => void
  /** After a title or due-date edit saves, with the saved task. */
  onSaved?: (task: Task) => void
  /** `YYYY-MM-DD`, for the due chip's words. */
  today: string
  /** For "Added today, 9:30"; null until the browser's clock is read. */
  now: Date | null
}

/**
 * One task row:
 * - a real checkbox, labelled by the title, to complete it;
 * - the title as a button that turns into an input (Enter or blur saves,
 *   Escape cancels);
 * - when it was added, and its due date as a small secondary chip;
 * - a Delete button.
 * A failed save shows the error here and keeps the draft.
 */
export function TaskItem({ task, onDelete, onSaved, today, now }: TaskItemProps) {
  const titleId = useId()
  const errorId = useId()
  const drafts = useEditDrafts()
  // A row moved to another group remounts; pick up its open editor, if any.
  const [restored] = useState(() => drafts.get(task.id))
  const [editing, setEditing] = useState(Boolean(restored))
  const [draft, setDraft] = useState(restored?.draft ?? task.title)
  // The latest typed text, readable after an await without a stale closure.
  const draftRef = useRef(draft)
  // The title when editing began. A draft equal to it is untouched and never
  // written, and saves compare-and-set against it, so another tab's newer
  // title is never silently overwritten (Codex review of Phases 4-6).
  const baseRef = useRef(restored?.base ?? task.title)
  // After a conflict, only Enter (keep mine) or Escape (keep theirs) decides.
  const conflicted = useRef(restored?.conflicted ?? false)
  const focusedRef = useRef(restored?.focused ?? false)
  const focusOnOpen = useRef(restored?.focused ?? false)
  const saveTitle = useAction(update)
  const toggle = useAction(update)
  const setDue = useAction(update)
  const setVital = useAction(update)
  const setLabels = useAction(update)

  const inputRef = useRef<HTMLInputElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  // Escape must stop the blur that follows it from saving, and Enter must
  // stop that blur from saving a second time.
  const settled = useRef(false)
  const wasEditing = useRef(editing)

  useEffect(() => {
    if (editing && focusOnOpen.current)
      inputRef.current?.focus()
    else if (!editing && wasEditing.current)
      editButtonRef.current?.focus()
    focusOnOpen.current = false
    wasEditing.current = editing
  }, [editing])

  function persist() {
    drafts.set(task.id, { draft: draftRef.current, base: baseRef.current, conflicted: conflicted.current, focused: focusedRef.current })
  }

  function changeDraft(value: string) {
    draftRef.current = value
    setDraft(value)
  }

  function startEditing() {
    settled.current = false
    baseRef.current = task.title
    conflicted.current = false
    focusedRef.current = true
    focusOnOpen.current = true
    changeDraft(task.title)
    persist()
    setEditing(true)
  }

  function close() {
    settled.current = true
    conflicted.current = false
    drafts.delete(task.id)
    setEditing(false)
  }

  async function commit() {
    if (settled.current)
      return
    const submitted = draftRef.current
    if (submitted.trim() === baseRef.current) {
      // Untouched, or put back as it was: nothing to write.
      close()
      return
    }
    settled.current = true
    try {
      const saved = await saveTitle.run(task.id, { title: submitted }, { expectTitle: baseRef.current })
      onSaved?.(saved)
      baseRef.current = saved.title
      conflicted.current = false
      if (draftRef.current !== submitted) {
        // More was typed while that save was in flight (found in place of
        // Phase 4's Codex review). Keep it: stay open, or save it straight
        // away if focus has already left the field.
        settled.current = false
        persist()
        if (document.activeElement !== inputRef.current)
          commit()
        return
      }
      close()
    }
    catch (error) {
      // Shown below; stay in the field with the draft so nothing is lost.
      settled.current = false
      if (error instanceof TitleConflictError) {
        // The next Enter knowingly replaces this newer title.
        baseRef.current = error.currentTitle
        conflicted.current = true
      }
      persist()
    }
  }

  function cancel() {
    changeDraft(task.title)
    close()
  }

  const error = saveTitle.error ?? toggle.error ?? setDue.error ?? setVital.error ?? setLabels.error

  return (
    <div className="flex items-start gap-1 rounded-xl bg-gray-50 p-2 hover:bg-gray-100 md:gap-2">
      {/* The checkbox's name is the title, from this always-present span. */}
      <span id={titleId} className="sr-only">{task.title}</span>
      {/* A 44px touch target around a 20px checkbox. */}
      <span className="flex h-11 w-11 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => toggle.fire(task.id, { completed: !task.completed })}
          aria-labelledby={titleId}
          data-task-id={task.id}
          className="h-5 w-5 accent-orange-500"
        />
      </span>

      <div className="min-w-0 flex-1 py-2">
        {editing
          ? (
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => {
                  changeDraft(e.target.value)
                  persist()
                }}
                onFocus={() => {
                  focusedRef.current = true
                  persist()
                }}
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
                onBlur={() => {
                  focusedRef.current = false
                  persist()
                  // After a conflict, leaving the field doesn't choose.
                  if (!conflicted.current)
                    commit()
                }}
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
                {task.vital === 1 && <Star className="mr-1 inline h-4 w-4 -translate-y-px fill-amber-400 text-amber-500" aria-hidden="true" />}
                {task.title}
              </button>
            )}
        {Boolean(error) && (
          <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">{saveErrorMessage(error)}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs text-gray-500">{now ? formatAdded(task.createdAt, now) : ''}</span>
          <button
            type="button"
            aria-pressed={task.vital === 1}
            aria-label={`Vital: "${task.title}"`}
            onClick={() => setVital.fire(task.id, { vital: task.vital !== 1 })}
            className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${task.vital === 1 ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <Star className={`h-3.5 w-3.5 ${task.vital === 1 ? 'fill-amber-400 text-amber-500' : ''}`} aria-hidden="true" />
            {/* Icon-only on phones to keep rows short; the button keeps its full name. */}
            <span className="hidden md:inline">Vital</span>
          </button>
          <DueChooser
            value={task.dueDate}
            onChange={(dueDate) => {
              setDue.run(task.id, { dueDate }).then(saved => onSaved?.(saved), () => {})
            }}
            today={today}
            subject={`"${task.title}"`}
          />
          <LabelChips ids={task.categoryIds} />
          <LabelChooser
            value={task.categoryIds}
            onChange={categoryIds => setLabels.fire(task.id, { categoryIds })}
            subject={`"${task.title}"`}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDelete(task)}
        aria-label={`Delete "${task.title}"`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
