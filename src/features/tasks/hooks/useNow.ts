'use client'

import { useSyncExternalStore } from 'react'

const MINUTE = 60_000

function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>
  const tick = () => {
    onChange()
    timer = setTimeout(tick, MINUTE - (Date.now() % MINUTE) + 20)
  }
  timer = setTimeout(tick, MINUTE - (Date.now() % MINUTE) + 20)
  document.addEventListener('visibilitychange', onChange)
  return () => {
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onChange)
  }
}

// Rounded to the minute, so the snapshot is stable between ticks.
const getSnapshot = () => Math.floor(Date.now() / MINUTE) * MINUTE
const getServerSnapshot = () => null

/**
 * The current time to the minute, or null during the server render and the
 * first client render. The page is prerendered at build time, so anything
 * clock-based baked in then would be stale and wouldn't match the browser's
 * first render (a hydration error).
 */
export function useNow(): Date | null {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return ms === null ? null : new Date(ms)
}
