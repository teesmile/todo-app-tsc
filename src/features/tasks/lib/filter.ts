import type { Task } from '../store/types'

export const FILTERS = ['all', 'active', 'done', 'today', 'overdue'] as const
export type TaskFilter = (typeof FILTERS)[number]

export const FILTER_LABELS: Record<TaskFilter, string> = {
  all: 'All',
  active: 'Active',
  done: 'Done',
  today: 'Today',
  overdue: 'Overdue',
}

export function isTaskFilter(value: unknown): value is TaskFilter {
  return typeof value === 'string' && (FILTERS as readonly string[]).includes(value)
}

/** Combining diacritical marks, the block NFD splits accents into. */
const MARKS_START = 0x0300
const MARKS_END = 0x036F

/** Lowercase with accents removed, so "Crème" matches "creme". */
export function normalizeText(value: string): string {
  let out = ''
  for (const char of value.normalize('NFD')) {
    const code = char.codePointAt(0)!
    if (code < MARKS_START || code > MARKS_END)
      out += char
  }
  return out.toLowerCase()
}

/** `tasks` narrowed to the filter and the search. Today and Overdue mean open tasks only. */
export function filterTasks(tasks: Task[], { filter = 'all', query = '' }: { filter?: TaskFilter, query?: string }, today: string): Task[] {
  // Every word must appear, in any order.
  const terms = normalizeText(query).split(/\s+/).filter(Boolean)
  return tasks.filter((task) => {
    if (filter === 'active' && task.completed)
      return false
    if (filter === 'done' && !task.completed)
      return false
    if (filter === 'today' && (task.completed || task.dueDate !== today))
      return false
    if (filter === 'overdue' && (task.completed || task.dueDate === null || task.dueDate >= today))
      return false
    if (terms.length === 0)
      return true
    const title = normalizeText(task.title)
    return terms.every(term => title.includes(term))
  })
}
