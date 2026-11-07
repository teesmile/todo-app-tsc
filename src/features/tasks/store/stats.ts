import type { Task } from './types'

export interface TaskStats {
  total: number
  completed: number
  active: number
  completedPercentage: number
  activePercentage: number
  /** The three most recently completed tasks, newest first. */
  recentlyCompleted: Task[]
}

/**
 * Stats over every live task passed in, not a page of them (audit 1.4).
 * Phase 5 extends this with due-today and overdue counts.
 */
export function computeStats(tasks: Task[]): TaskStats {
  const done = tasks.filter(task => task.completed)
  const total = tasks.length
  const percent = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))

  return {
    total,
    completed: done.length,
    active: total - done.length,
    completedPercentage: percent(done.length),
    activePercentage: percent(total - done.length),
    recentlyCompleted: [...done]
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, 3),
  }
}
