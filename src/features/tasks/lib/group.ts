import type { Task } from '../store/types'
import { nextDay } from './dates'

/** The date groups, plus 'newest': the single list of the Newest view. */
export type GroupKey = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'none' | 'done' | 'newest'

/** How the list is ordered: one list newest-added first (the default), or grouped by due date. */
export const SORTS = ['newest', 'due'] as const
export type TaskSort = (typeof SORTS)[number]

export const SORT_LABELS: Record<TaskSort, string> = {
  newest: 'Newest',
  due: 'Due date',
}

export function isTaskSort(value: unknown): value is TaskSort {
  return typeof value === 'string' && (SORTS as readonly string[]).includes(value)
}

export interface TaskGroup {
  key: GroupKey
  label: string
  tasks: Task[]
}

const ORDER: { key: GroupKey, label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'none', label: 'No date' },
  { key: 'done', label: 'Done' },
]

/** Which group an open or completed task belongs to on `today` (`YYYY-MM-DD`). */
export function groupKeyFor(task: Task, today: string, tomorrow = nextDay(today)): GroupKey {
  if (task.completed)
    return 'done'
  if (task.dueDate === null)
    return 'none'
  // ISO dates compare correctly as strings.
  if (task.dueDate < today)
    return 'overdue'
  if (task.dueDate === today)
    return 'today'
  if (task.dueDate === tomorrow)
    return 'tomorrow'
  return 'upcoming'
}

/**
 * Newest added first, ties broken by id so the order is stable. The open
 * groups use it, so a task you just added is always at the top of its group
 * (owner, 2026-11-09; it replaced Vital first, then due date).
 */
function byNewest(a: Task, b: Task) {
  return b.createdAt - a.createdAt || a.id.localeCompare(b.id)
}

/** Done in the Due date view: most recently completed first (owner, 2026-11-09). */
function byMostRecentlyDone(a: Task, b: Task) {
  return (b.completedAt ?? 0) - (a.completedAt ?? 0) || a.id.localeCompare(b.id)
}

/**
 * Splits live tasks into the six groups (decision 4), always in the same
 * order, including empty ones. Completed tasks always go to Done, even if
 * overdue. Inside the open groups, newest added first, so a task you just
 * added shows at the top of its group; Done is most recently completed first. Pure: `today` is passed in, so midnight
 * and month ends are testable without a fake clock.
 */
export function groupTasks(tasks: Task[], today: string): TaskGroup[] {
  const tomorrow = nextDay(today)
  const buckets = new Map<GroupKey, Task[]>(ORDER.map(({ key }) => [key, []]))
  for (const task of tasks)
    buckets.get(groupKeyFor(task, today, tomorrow))!.push(task)

  return ORDER.map(({ key, label }) => ({
    key,
    label,
    tasks: buckets.get(key)!.sort(key === 'done' ? byMostRecentlyDone : byNewest),
  }))
}

/**
 * The Newest view: one list, open tasks newest added first, then completed
 * ones (newest added first too), so finished work sinks to the bottom.
 */
export function listNewest(tasks: Task[]): TaskGroup[] {
  const open = tasks.filter(t => !t.completed).sort(byNewest)
  const done = tasks.filter(t => t.completed).sort(byNewest)
  return [{ key: 'newest', label: 'All tasks, newest first', tasks: [...open, ...done] }]
}

/** The groups for a view: one Newest list, or the date groups. */
export function arrangeTasks(tasks: Task[], sort: TaskSort, today: string): TaskGroup[] {
  return sort === 'newest' ? listNewest(tasks) : groupTasks(tasks, today)
}

/** Which group of the current view a task is in. */
export function groupKeyIn(task: Task, sort: TaskSort, today: string): GroupKey {
  return sort === 'newest' ? 'newest' : groupKeyFor(task, today)
}
