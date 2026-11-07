import type { Task } from '../store/types'
import { describe, expect, it } from 'vitest'
import { FILTERS, filterTasks, isTaskFilter, normalizeText } from './filter'

const today = '2026-11-07'
let n = 0
function task(title: string, overrides: Partial<Task> = {}): Task {
  n += 1
  return { id: `t${n}`, ownerId: 'guest', title, completed: false, dueDate: null, isSample: 0, dirty: 0, rev: 1, createdAt: n, updatedAt: n, completedAt: null, deletedAt: null, ...overrides }
}

const overdueOpen = task('Renew the passport', { dueDate: '2026-11-01' })
const overdueDone = task('Old done thing', { dueDate: '2026-11-01', completed: true, completedAt: 1 })
const todayOpen = task('Crème brûlée for dinner', { dueDate: today })
const todayDone = task('Water the plants', { dueDate: today, completed: true, completedAt: 2 })
const later = task('Plan the trip', { dueDate: '2026-12-01' })
const undated = task('Read a book')
const all = [overdueOpen, overdueDone, todayOpen, todayDone, later, undated]

const ids = (tasks: Task[]) => tasks.map(t => t.id)

describe('filterTasks by filter', () => {
  it.each([
    ['all', all],
    ['active', [overdueOpen, todayOpen, later, undated]],
    ['done', [overdueDone, todayDone]],
    ['today', [todayOpen]],
    ['overdue', [overdueOpen]],
  ] as const)('%s', (filter, expected) => {
    expect(ids(filterTasks(all, { filter }, today))).toEqual(ids([...expected]))
  })
})

describe('filterTasks by search', () => {
  it('ignores case and accents in both directions', () => {
    expect(ids(filterTasks(all, { query: 'CREME' }, today))).toEqual([todayOpen.id])
    expect(ids(filterTasks([task('creme fraiche')], { query: 'crème' }, today))).toHaveLength(1)
  })

  it('needs every word, in any order', () => {
    expect(ids(filterTasks(all, { query: 'passport renew' }, today))).toEqual([overdueOpen.id])
    expect(filterTasks(all, { query: 'passport book' }, today)).toEqual([])
  })

  it('treats blank space as no search', () => {
    expect(filterTasks(all, { query: '   ' }, today)).toEqual(all)
  })

  it.each(FILTERS)('combines with the %s filter', (filter) => {
    const matches = filterTasks(all, { filter, query: 'the' }, today)
    for (const match of matches) {
      expect(normalizeText(match.title)).toContain('the')
      expect(filterTasks(all, { filter }, today)).toContain(match)
    }
  })
})

describe('isTaskFilter', () => {
  it('accepts known filters and rejects anything else from the URL', () => {
    expect(isTaskFilter('overdue')).toBe(true)
    expect(isTaskFilter('OVERDUE')).toBe(false)
    expect(isTaskFilter(null)).toBe(false)
  })
})
