import type { Task } from '../store/types'
import { describe, expect, it } from 'vitest'
import { nextDay } from './dates'
import { arrangeTasks, groupKeyFor, groupKeyIn, groupTasks, isTaskSort } from './group'

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

describe('task order (owner, 2026-11-09): a task just added is at the top', () => {
  const today = '2026-11-09'

  it('sorts every group newest-added first, Vital and due date no longer ahead of it', () => {
    const olderVital = task({ dueDate: '2026-11-20', vital: 1, createdAt: 100 })
    const olderSooner = task({ dueDate: '2026-11-12', createdAt: 200 })
    const newest = task({ dueDate: '2026-11-25', createdAt: 300 })
    const doneOld = task({ completed: true, completedAt: 999, createdAt: 10 })
    const doneNew = task({ completed: true, completedAt: 500, createdAt: 20 })
    const groups = groupTasks([olderVital, olderSooner, newest, doneOld, doneNew], today)
    expect(groups.find(g => g.key === 'upcoming')!.tasks.map(t => t.id)).toEqual([newest.id, olderSooner.id, olderVital.id])
    expect(groups.find(g => g.key === 'done')!.tasks.map(t => t.id)).toEqual([doneNew.id, doneOld.id])
  })

  it('"Newest" is one list: open tasks newest-added first, then completed ones, newest-added first', () => {
    const a = task({ createdAt: 1, dueDate: '2026-11-01' })
    const b = task({ createdAt: 3, completed: true, completedAt: 50 })
    const c = task({ createdAt: 2 })
    const d = task({ createdAt: 4, dueDate: '2026-11-30', vital: 1 })
    const e = task({ createdAt: 5, completed: true, completedAt: 40 })
    const groups = arrangeTasks([a, b, c, d, e], 'newest', today)
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('newest')
    expect(groups[0].tasks.map(t => t.id)).toEqual([d.id, c.id, a.id, e.id, b.id])
  })

  it('"Due date" is the grouped view, and each view knows which group a task lands in', () => {
    const t = task({ dueDate: today })
    expect(arrangeTasks([t], 'due', today).map(g => g.key)).toEqual(['overdue', 'today', 'tomorrow', 'upcoming', 'none', 'done'])
    expect(groupKeyIn(t, 'due', today)).toBe('today')
    expect(groupKeyIn(t, 'newest', today)).toBe('newest')
  })

  it('reads the sort from the URL value, "newest" by default', () => {
    expect(isTaskSort('due')).toBe(true)
    expect(isTaskSort('newest')).toBe(true)
    expect(isTaskSort('oldest')).toBe(false)
    expect(isTaskSort(null)).toBe(false)
  })
})
