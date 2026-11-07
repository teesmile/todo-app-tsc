import type { Task } from './types'
import { describe, expect, it } from 'vitest'
import { computeStats } from './stats'

const today = '2026-11-07'
function task(i: number, overrides: Partial<Task> = {}): Task {
  return { id: `t${i}`, ownerId: 'guest', title: `Task ${i}`, completed: false, dueDate: null, isSample: 0, dirty: 0, rev: 1, createdAt: i, updatedAt: i, completedAt: null, deletedAt: null, ...overrides }
}

describe('computeStats', () => {
  it('is all zeros for no tasks', () => {
    expect(computeStats([], today)).toEqual({ total: 0, completed: 0, active: 0, overdue: 0, dueToday: 0, completedPercentage: 0, activePercentage: 0, recentlyCompleted: [] })
  })

  it('counts a single open task due today', () => {
    expect(computeStats([task(1, { dueDate: today })], today)).toMatchObject({ total: 1, active: 1, completed: 0, dueToday: 1, overdue: 0, completedPercentage: 0, activePercentage: 100 })
  })

  it('counts 500 tasks, every one of them (no first-100 cut, audit 1.4)', () => {
    const tasks = Array.from({ length: 500 }, (_, i) => task(i, {
      completed: i % 5 === 0,
      completedAt: i % 5 === 0 ? i : null,
      dueDate: i % 3 === 0 ? '2026-11-01' : i % 3 === 1 ? today : null,
    }))
    const stats = computeStats(tasks, today)
    const open = tasks.filter(t => !t.completed)
    expect(stats.total).toBe(500)
    expect(stats.completed).toBe(100)
    expect(stats.active).toBe(400)
    expect(stats.overdue).toBe(open.filter(t => t.dueDate === '2026-11-01').length)
    expect(stats.dueToday).toBe(open.filter(t => t.dueDate === today).length)
    expect(stats.completedPercentage).toBe(20)
    expect(stats.recentlyCompleted.map(t => t.completedAt)).toEqual([495, 490, 485])
  })

  it('does not count a completed task as overdue or due today', () => {
    expect(computeStats([task(1, { dueDate: '2026-11-01', completed: true, completedAt: 1 }), task(2, { dueDate: today, completed: true, completedAt: 2 })], today)).toMatchObject({ overdue: 0, dueToday: 0, completed: 2 })
  })
})
