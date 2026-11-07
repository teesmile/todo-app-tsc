import type { Task } from '../store/types'
import { nextDay } from './dates'

export type GroupKey = 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'none' | 'done'

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

// Vital first (Phase 7), then due date, then newest first.
function byDueThenNewest(a: Task, b: Task) {
  return b.vital - a.vital || (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || b.createdAt - a.createdAt || a.id.localeCompare(b.id)
}

function byMostRecentlyDone(a: Task, b: Task) {
  return (b.completedAt ?? 0) - (a.completedAt ?? 0) || a.id.localeCompare(b.id)
}

/**
 * Splits live tasks into the six groups (decision 4), always in the same
 * order, including empty ones. Completed tasks always go to Done, even if
 * overdue. Inside a date group: Vital first (Phase 7), then due date, then
 * newest first; Done is untouched by Vital. So a task you
 * just added shows at the top of its group. Done is most recently completed
 * first. Pure: `today` is passed in, so midnight and month ends are testable
 * without a fake clock.
 */
export function groupTasks(tasks: Task[], today: string): TaskGroup[] {
  const tomorrow = nextDay(today)
  const buckets = new Map<GroupKey, Task[]>(ORDER.map(({ key }) => [key, []]))
  for (const task of tasks)
    buckets.get(groupKeyFor(task, today, tomorrow))!.push(task)

  return ORDER.map(({ key, label }) => ({
    key,
    label,
    tasks: buckets.get(key)!.sort(key === 'done' ? byMostRecentlyDone : byDueThenNewest),
  }))
}
