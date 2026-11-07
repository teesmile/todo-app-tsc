'use client'

import type { FocusTarget } from '../lib/focus'
import type { Task, UndoToken } from '../store/types'
import type { Toast } from './undoToast'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useListParams } from '../hooks/useListParams'
import { useNow } from '../hooks/useNow'
import { useShortcuts } from '../hooks/useShortcuts'
import { useToday } from '../hooks/useToday'
import { saveErrorMessage } from '../lib/errors'
import { FILTER_LABELS, filterTasks } from '../lib/filter'
import { focusAfterRemoving } from '../lib/focus'
import { groupTasks } from '../lib/group'
import { useTasks } from '../store/hooks'
import { clearSamples, purgeGuestTombstones, remove, undoRemove } from '../store/repository'
import { AddTaskForm } from './addTaskForm'
import { AddTaskSheet } from './addTaskSheet'
import { EditDrafts, EditDraftsContext } from './editDrafts'
import { TaskGroup } from './taskGroup'
import { TaskToolbar } from './taskToolbar'
import { UndoToast } from './undoToast'

/**
 * The task list: the add form (inline from tablet width, a bottom sheet on
 * phones), search and filters, the date groups and the undo toast.
 */
export function TaskList() {
  const tasks = useTasks()
  const today = useToday()
  const now = useNow()
  const { filter, setFilter, query, setQuery } = useListParams()
  // Filtering is a pure pass over tasks already in memory: instant, no debounce.
  const shown = useMemo(() => (tasks ? filterTasks(tasks, { filter, query }, today) : undefined), [tasks, filter, query, today])
  const groups = useMemo(() => (shown ? groupTasks(shown, today).filter(g => g.tasks.length > 0) : undefined), [shown, today])
  const hasSamples = tasks?.some(task => task.isSample === 1) ?? false

  // Open inline editors, by task id, so a row that changes group keeps its draft.
  const [drafts] = useState(() => new EditDrafts())
  const listRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  // While the Today filter is on, a new task is due today, or it would vanish
  // from the view it was added in. The add form's Due chip shows this.
  const defaultDue = filter === 'today' ? today : null

  useShortcuts({
    // The inline form is hidden below tablet width, so there `n` opens the sheet.
    'n': () => (window.matchMedia('(min-width: 768px)').matches ? addRef.current?.focus() : setSheetOpen(true)),
    '/': () => searchRef.current?.focus(),
  })
  const [toast, setToast] = useState<Toast | null>(null)
  // Where focus goes next. A ref plus a request counter, so the effect below
  // only reads and clears it and never sets state itself.
  const pendingFocus = useRef<FocusTarget | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const requestFocus = useCallback((target: FocusTarget) => {
    pendingFocus.current = target
    setFocusRequest(n => n + 1)
  }, [])
  const [error, setError] = useState<unknown>(null)
  const closeToast = useCallback(() => setToast(null), [])

  // Guest tombstones only exist for undo; once their window has passed,
  // nothing will ever need them. Once per page load.
  useEffect(() => {
    purgeGuestTombstones().catch(err => console.error('Could not purge old deleted tasks', err))
  }, [])

  // Apply a pending focus target once the element exists. A restored row only
  // appears after the live query re-runs, so this retries when tasks change.
  useEffect(() => {
    const target = pendingFocus.current
    if (!target)
      return
    let element: HTMLElement | null | undefined
    if (target.kind === 'add')
      element = addRef.current
    else if (target.kind === 'heading')
      element = listRef.current?.querySelector<HTMLElement>(`[data-group-heading="${target.group}"]`)
    else
      element = listRef.current?.querySelector<HTMLElement>(`[data-task-id="${target.id}"]`)
    if (element) {
      element.focus()
      pendingFocus.current = null
    }
  }, [focusRequest, tasks])

  const undo = useCallback(async (tokens: UndoToken[], what: string) => {
    try {
      const restored = await Promise.all(tokens.map(token => undoRemove(token)))
      if (restored.some(Boolean)) {
        requestFocus({ kind: 'row', id: tokens[0].id })
        setToast({ id: crypto.randomUUID(), message: `Restored ${what}`, durationMs: 3000 })
      }
      else {
        // Already gone for good (another tab purged it): say so, rather than
        // closing the toast as if it had worked.
        setToast({ id: crypto.randomUUID(), message: `${what} couldn't be undone: it's already gone.`, durationMs: 4000 })
      }
    }
    catch (err) {
      setError(err)
    }
  }, [requestFocus])

  const handleDelete = useCallback(async (task: Task) => {
    if (!groups)
      return
    // A double-click sends a second remove() before the first commits; it
    // finds the tombstone and returns no token, so there's one toast.
    const target = focusAfterRemoving(groups, task.id)
    try {
      setError(null)
      const token = await remove(task.id)
      if (token) {
        requestFocus(target)
        const what = `"${task.title}"`
        setToast({ id: crypto.randomUUID(), message: `Deleted ${what}`, action: { label: 'Undo', run: () => undo([token], what) } })
      }
    }
    catch (err) {
      setError(err)
    }
  }, [groups, undo, requestFocus])

  /**
   * After an add or an edit: if the current search or filter hides the task,
   * say so and offer Show all, so a save never looks like a disappearance.
   * (Found by the Phase 5 hand checks.) Returns whether it was hidden.
   */
  function reportIfHidden(task: Task, verb: 'Added' | 'Saved'): boolean {
    if (filterTasks([task], { filter, query }, today).length > 0)
      return false
    setToast({
      id: crypto.randomUUID(),
      message: `${verb} "${task.title}", but the current search or filter hides it.`,
      action: {
        label: 'Show all',
        run: () => {
          // Query first: setFilter writes the URL with the latest query.
          setQuery('')
          setFilter('all')
          setToast(null)
          requestFocus({ kind: 'row', id: task.id })
        },
      },
    })
    return true
  }

  async function handleClearSamples() {
    try {
      setError(null)
      const tokens = await clearSamples()
      if (tokens.length) {
        requestFocus({ kind: 'add' })
        const what = `${tokens.length} sample task${tokens.length === 1 ? '' : 's'}`
        setToast({ id: crypto.randomUUID(), message: `Cleared ${what}`, action: { label: 'Undo', run: () => undo(tokens, what) } })
      }
    }
    catch (err) {
      setError(err)
    }
  }

  return (
    <EditDraftsContext value={drafts}>
      <div ref={listRef} className="space-y-5">
        {/* Inline from tablet width; on phones the floating button opens the sheet. */}
        <div className="hidden md:block">
          <AddTaskForm titleRef={addRef} today={today} defaultDue={defaultDue} onAdded={task => reportIfHidden(task, 'Added')} />
        </div>

        <TaskToolbar
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setFilter}
          shown={shown?.length}
          searchRef={searchRef}
        />

        {Boolean(error) && (
          <p role="alert" className="text-sm text-red-600">{saveErrorMessage(error)}</p>
        )}

        {groups === undefined
          ? (
              <div role="status" className="flex items-center justify-center py-12">
                <Loader2 className="h-10 w-10 animate-spin text-orange-500 motion-reduce:animate-none" aria-hidden="true" />
                <span className="sr-only">Loading tasks</span>
              </div>
            )
          : groups.length === 0
            ? (
                <p className="py-8 text-center text-gray-500">
                  {tasks?.length === 0
                    ? 'No tasks yet. Add your first one.'
                    : query.trim()
                      ? `No ${filter === 'all' ? '' : `${FILTER_LABELS[filter].toLowerCase()} `}tasks match "${query.trim()}".`
                      : `No ${FILTER_LABELS[filter].toLowerCase()} tasks.`}
                </p>
              )
            : groups.map(group => <TaskGroup key={group.key} group={group} onDelete={handleDelete} onSaved={task => reportIfHidden(task, 'Saved')} today={today} now={now} />)}

        {hasSamples && (
          <div className="border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={handleClearSamples}
              className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
            >
              Clear sample tasks
            </button>
          </div>
        )}

        <AddTaskSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          today={today}
          defaultDue={defaultDue}
          onAdded={(task) => {
            if (!reportIfHidden(task, 'Added'))
              setToast({ id: crypto.randomUUID(), message: `Added "${task.title}"`, durationMs: 3000 })
          }}
        />
        <UndoToast toast={toast} onClose={closeToast} />
      </div>
    </EditDraftsContext>
  )
}
