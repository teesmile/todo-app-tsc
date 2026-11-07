/**
 * Due dates are local calendar dates stored as `YYYY-MM-DD` strings, never as
 * `Date` objects. A task due "today" must stay due today when the device
 * changes timezone; a timestamp at local midnight would slide to yesterday.
 */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** `date` moved by `days` calendar days, keeping the local time of day. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Parses `YYYY-MM-DD` as a local date, at noon so no DST shift can move the day. */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

/** The calendar day after `value`, as `YYYY-MM-DD`. */
export function nextDay(value: string): string {
  return toLocalDateString(addDays(parseLocalDate(value), 1))
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const short = (word: string) => word.slice(0, 3)

/** "Saturday 7 November", the header's date. */
export function formatLongDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

/** "Good morning" before noon, "Good afternoon" until 6pm, else "Good evening". */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12)
    return 'Good morning'
  if (hour >= 12 && hour < 18)
    return 'Good afternoon'
  return 'Good evening'
}

/**
 * When a task was added, from its automatic `createdAt`: "Added today, 9:30",
 * "Added yesterday, 18:05", "Added 3 Nov", or "Added 3 Nov 2025" in another
 * year. Local time, 24-hour.
 */
export function formatAdded(createdAt: number, now: Date): string {
  const added = new Date(createdAt)
  const time = `${added.getHours()}:${String(added.getMinutes()).padStart(2, '0')}`
  const addedDay = toLocalDateString(added)
  const today = toLocalDateString(now)
  if (addedDay === today)
    return `Added today, ${time}`
  if (nextDay(addedDay) === today)
    return `Added yesterday, ${time}`
  const dayMonth = `${added.getDate()} ${short(MONTHS[added.getMonth()])}`
  return added.getFullYear() === now.getFullYear() ? `Added ${dayMonth}` : `Added ${dayMonth} ${added.getFullYear()}`
}

/**
 * The due-date chip: "Due today", "Due tomorrow", "Due Fri 14 Nov",
 * "Overdue · Mon 3 Nov", with the year added when it isn't this year.
 */
export function formatDue(dueDate: string, today: string): string {
  if (dueDate === today)
    return 'Due today'
  if (dueDate === nextDay(today))
    return 'Due tomorrow'
  const due = parseLocalDate(dueDate)
  const thisYear = parseLocalDate(today).getFullYear()
  const when = `${short(WEEKDAYS[due.getDay()])} ${due.getDate()} ${short(MONTHS[due.getMonth()])}${due.getFullYear() === thisYear ? '' : ` ${due.getFullYear()}`}`
  return dueDate < today ? `Overdue · ${when}` : `Due ${when}`
}
