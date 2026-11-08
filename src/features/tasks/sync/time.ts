/**
 * Server timestamps carry microseconds ("2026-11-07T23:44:40.123456+00:00").
 * A JS Date keeps only milliseconds, so two server stamps a few microseconds
 * apart would compare equal. Cursor comparisons use these exact values.
 */

const PATTERN = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?(Z|[+-]\d\d(?::?\d\d)?)$/

/**
 * Microseconds since the epoch, exactly. About 1.8e15 today, well inside
 * Number.MAX_SAFE_INTEGER (9e15), so a plain number holds it without loss.
 */
export function toMicros(iso: string): number {
  const match = PATTERN.exec(iso.replace(' ', 'T'))
  if (!match)
    throw new Error(`Not a timestamp: ${iso}`)
  const [, base, fraction = '', zone] = match
  const offset = zone === 'Z' ? 'Z' : zone.length === 3 ? `${zone}:00` : zone.includes(':') ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`
  return Date.parse(`${base}${offset}`) * 1000 + Number(fraction.padEnd(6, '0').slice(0, 6))
}

export function compareStamps(a: string, b: string): number {
  const x = toMicros(a)
  const y = toMicros(b)
  return x < y ? -1 : x > y ? 1 : 0
}

/** Epoch ms to ISO, for the timestamps the client sets. */
export function iso(ms: number): string {
  return new Date(ms).toISOString()
}

/** ISO to epoch ms (microseconds truncated), for local fields. */
export function ms(stamp: string): number {
  return Math.floor(toMicros(stamp) / 1000)
}
