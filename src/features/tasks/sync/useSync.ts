'use client'

import type { Remote } from './types'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getDb } from '../store/db'
import { unsyncedFingerprint } from './account'
import { SyncCancelledError, syncNow } from './engine'
import { RemoteError } from './types'

export type SyncStatus = 'syncing' | 'synced' | 'offline' | 'unavailable' | 'signin-needed'

export const SYNC_AFTER_WRITE_MS = 2000
export const SYNC_INTERVAL_MS = 60_000
const BACKOFF_START_MS = 5000
const BACKOFF_MAX_MS = 5 * 60_000

/** The wait after `failures` failed syncs in a row: 5s, 10s, 20s… up to 5 minutes. */
export function backoffMs(failures: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_START_MS * 2 ** Math.max(0, failures - 1))
}

function statusFor(error: unknown): SyncStatus {
  if (error instanceof RemoteError)
    return error.kind === 'offline' ? 'offline' : error.kind === 'auth' ? 'signin-needed' : 'unavailable'
  return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unavailable'
}

/**
 * Runs sync for a signed-in user. One run at a time; a trigger during a run
 * queues one more. Triggers: start (sign-in), the tab becoming visible, the
 * network coming back, 2s after the last local change, every 60s while
 * visible, and the end of a delete's undo window. Failures back off
 * exponentially to 5 minutes and leave every change queued on the device.
 */
export function useSync(userId: string | null, remote: Remote | null, { startOffline = false } = {}) {
  const [status, setStatus] = useState<SyncStatus>(startOffline ? 'offline' : 'syncing')
  const running = useRef(false)
  const again = useRef(false)
  const failures = useRef(0)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const run = useCallback(async () => {
    if (!userId || !remote)
      return
    if (running.current) {
      again.current = true
      return
    }
    running.current = true
    clearTimeout(retryTimer.current)
    setStatus('syncing')
    try {
      const { retryAt } = await syncNow({ db: getDb(), remote, userId })
      failures.current = 0
      setStatus('synced')
      if (retryAt !== null)
        retryTimer.current = setTimeout(() => void run(), Math.max(0, retryAt - Date.now()) + 50)
    }
    catch (error) {
      // Signed out on this device mid-run: nothing failed, there's just no one to sync for.
      if (error instanceof SyncCancelledError)
        return
      failures.current += 1
      setStatus(statusFor(error))
      if (!(error instanceof RemoteError && error.kind === 'auth'))
        retryTimer.current = setTimeout(() => void run(), backoffMs(failures.current))
    }
    finally {
      running.current = false
      if (again.current) {
        again.current = false
        void run()
      }
    }
  }, [userId, remote])

  // Start, and the visibility, network and interval triggers.
  useEffect(() => {
    if (!userId || !remote)
      return
    void run()
    const onVisible = () => {
      if (document.visibilityState === 'visible')
        void run()
    }
    const onOnline = () => {
      failures.current = 0
      void run()
    }
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible')
        void run()
    }, SYNC_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(interval)
      clearTimeout(retryTimer.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [userId, remote, run])

  // 2s after the last local change: the fingerprint is a live query that
  // moves on every write to an unsynced row, in any tab, restarting the timer.
  const pending = useLiveQuery(() => (userId ? unsyncedFingerprint(userId) : ''), [userId])
  useEffect(() => {
    if (!userId || !remote || !pending)
      return
    const timer = setTimeout(() => void run(), SYNC_AFTER_WRITE_MS)
    return () => clearTimeout(timer)
  }, [pending, userId, remote, run])

  return { status, syncNow: run }
}
