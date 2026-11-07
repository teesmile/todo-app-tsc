import { describe, expect, it } from 'vitest'
import { formatAdded, formatDue, formatLongDate, greetingFor } from './dates'

const now = new Date(2026, 10, 7, 14, 0) // Saturday 7 November 2026, 14:00

describe('formatAdded', () => {
  it.each([
    [new Date(2026, 10, 7, 9, 30), 'Added today, 9:30'],
    [new Date(2026, 10, 7, 0, 5), 'Added today, 0:05'],
    [new Date(2026, 10, 6, 18, 5), 'Added yesterday, 18:05'],
    [new Date(2026, 10, 3, 12, 0), 'Added 3 Nov'],
    [new Date(2025, 10, 3, 12, 0), 'Added 3 Nov 2025'],
  ])('%s -> %s', (added, label) => {
    expect(formatAdded(added.getTime(), now)).toBe(label)
  })

  it('calls the last day of last year "yesterday" on 1 January', () => {
    expect(formatAdded(new Date(2026, 11, 31, 23, 0).getTime(), new Date(2027, 0, 1, 8, 0))).toBe('Added yesterday, 23:00')
  })
})

describe('formatDue', () => {
  it.each([
    ['2026-11-07', 'Due today'],
    ['2026-11-08', 'Due tomorrow'],
    ['2026-11-13', 'Due Fri 13 Nov'],
    ['2026-11-03', 'Overdue · Tue 3 Nov'],
    ['2027-01-04', 'Due Mon 4 Jan 2027'],
  ])('%s -> %s', (due, label) => {
    expect(formatDue(due, '2026-11-07')).toBe(label)
  })
})

describe('header words', () => {
  it('formats the long date the way the header shows it', () => {
    expect(formatLongDate(now)).toBe('Saturday 7 November')
  })

  it.each([[4, 'Good evening'], [5, 'Good morning'], [11, 'Good morning'], [12, 'Good afternoon'], [17, 'Good afternoon'], [18, 'Good evening'], [23, 'Good evening']])('hour %i -> %s', (hour, greeting) => {
    expect(greetingFor(hour)).toBe(greeting)
  })
})
