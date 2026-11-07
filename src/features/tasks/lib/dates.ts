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
