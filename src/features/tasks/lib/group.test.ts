import type { Task } from '../store/types'
import { describe, expect, it } from 'vitest'
import { nextDay } from './dates'
import { groupKeyFor, groupTasks } from './group'

let n = 0
function task(overrides: Partial<Task> = {}): Task {
  n += 1
  return {
    id: `id-${String(n).padStart(3, '0')}`,
    ownerId: 'guest',
    title: `Task ${n}`,
    completed: false,
    dueDate: null,
    isSample: 0,
    dirty: 0,
    rev: 1,
    createdAt: n,
    updatedAt: n,
    completedAt: null,
    deletedAt: null,
    vital: 0,
    categoryIds: [],
    ...overrides,
  }
}

function keyOn(today: string, dueDate: string | null, completed = false) {
  return groupKeyFor(task({ dueDate, completed }), today)
}

describe('nextDay', () => {
  it.each([
    ['2026-01-31', '2026-02-01'], // end of a month
    ['2026-12-31', '2027-01-01'], // end of a year
    ['2028-02-28', '2028-02-29'], // into a leap day
    ['2028-02-29', '2028-03-01'], // out of a leap day
    ['2027-02-28', '2027-03-01'], // no leap day
    ['2026-03-29', '2026-03-30'], // a European DST change
  ])('%s -> %s', (from, to) => {
    expect(nextDay(from)).toBe(to)
  })
})

describe('groupKeyFor', () => {
  it('puts tomorrow correctly across a month end, a year end and a leap day', () => {
    expect(keyOn('2026-01-31', '2026-02-01')).toBe('tomorrow')
    expect(keyOn('2026-12-31', '2027-01-01')).toBe('tomorrow')
    expect(keyOn('2028-02-28', '2028-02-29')).toBe('tomorrow')
    expect(keyOn('2028-02-29', '2028-03-01')).toBe('tomorrow')
  })

  it('calls yesterday overdue and the day after tomorrow upcoming, across a year end', () => {
    expect(keyOn('2027-01-01', '2026-12-31')).toBe('overdue')
    expect(keyOn('2026-12-31', '2027-01-02')).toBe('upcoming')
  })

  it('sends a completed task to Done even when it is overdue', () => {
    expect(keyOn('2026-11-07', '2026-11-01', true)).toBe('done')
  })

  it('sends a task with no due date to No date', () => {
    expect(keyOn('2026-11-07', null)).toBe('none')
  })
})

describe('groupTasks', () => {
  it('returns all six groups in a fixed order, empty ones included', () => {
    expect(groupTasks([], '2026-11-07').map(g => g.key)).toEqual(['overdue', 'today', 'tomorrow', 'upcoming', 'none', 'done'])
  })

  it('sorts by due date, then newest first, and Done by most recently completed', () => {
    const today = '2026-11-07'
    const lateA = task({ dueDate: '2026-11-20', createdAt: 10 })
    const soon = task({ dueDate: '2026-11-10', createdAt: 5 })
    const lateB = task({ dueDate: '2026-11-20', createdAt: 30 })
    const doneFirst = task({ completed: true, completedAt: 100 })
    const doneLast = task({ completed: true, completedAt: 300 })

    const groups = Object.fromEntries(groupTasks([lateA, soon, lateB, doneFirst, doneLast], today).map(g => [g.key, g.tasks]))
    expect(groups.upcoming).toEqual([soon, lateB, lateA])
    expect(groups.done).toEqual([doneLast, doneFirst])
  })

  it('places every task in exactly one group', () => {
    const today = '2026-11-07'
    const tasks = [
      task({ dueDate: '2026-11-01' }),
      task({ dueDate: today }),
      task({ dueDate: '2026-11-08' }),
      task({ dueDate: '2027-03-01' }),
      task(),
      task({ completed: true, dueDate: '2026-10-01' }),
    ]
    const groups = groupTasks(tasks, today)
    expect(groups.flatMap(g => g.tasks)).toHaveLength(tasks.length)
    expect(groups.map(g => g.tasks.length)).toEqual([1, 1, 1, 1, 1, 1])
  })
})
