import type { Task } from './types'

export interface TaskStats {
  total: number
  completed: number
  active: number
  /** Open tasks due before today. */
  overdue: number
  /** Open tasks due today. */
  dueToday: number
  completedPercentage: number
  activePercentage: number
  /** The three most recently completed tasks, newest first. */
  recentlyCompleted: Task[]
}

/**
 * Stats over every live task passed in, never a page or a filtered view
 * (audit 1.4). `today` is `YYYY-MM-DD`, passed in so this stays pure.
 */
export function computeStats(tasks: Task[], today: string): TaskStats {
  let completed = 0
  let overdue = 0
  let dueToday = 0
  const done: Task[] = []
  for (const task of tasks) {
    if (task.completed) {
      completed += 1
      done.push(task)
    }
    else if (task.dueDate !== null) {
      if (task.dueDate < today)
        overdue += 1
      else if (task.dueDate === today)
        dueToday += 1
    }
  }
  const total = tasks.length
  const percent = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))

  return {
    total,
    completed,
    active: total - completed,
    overdue,
    dueToday,
    completedPercentage: percent(completed),
    activePercentage: percent(total - completed),
    recentlyCompleted: done
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, 3),
  }
}
