'use client'

import { useEffect, useState } from 'react'
import { toLocalDateString } from '../lib/dates'

/** Milliseconds from `now` until just after the next local midnight. */
export function msUntilNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 50)
  return next.getTime() - now.getTime()
}

/**
 * Today's local date as `YYYY-MM-DD`, re-checked just after midnight and
 * whenever the tab becomes visible again. A list left open overnight then
 * moves Tomorrow into Today without a reload, and a laptop that slept
 * through midnight catches up as soon as it's looked at.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => toLocalDateString(new Date()))

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => setToday(toLocalDateString(new Date()))
    const schedule = () => {
      timer = setTimeout(() => {
        refresh()
        schedule()
      }, msUntilNextMidnight(new Date()))
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible')
        refresh()
    }

    schedule()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return today
}
