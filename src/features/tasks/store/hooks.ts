'use client'

import type { TaskStats } from './stats'
import type { OwnerId, Task } from './types'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { runLegacyImport } from './legacyImport'
import { listTasks } from './repository'
import { computeStats } from './stats'
import { GUEST } from './types'

/**
 * Live, newest-first tasks for the current owner. `undefined` means still
 * loading, and `[]` means there are no tasks, so the empty state never
 * flashes on load. The query re-runs whenever a write touches the rows it
 * read, including writes from another tab.
 */
export function useTasks(ownerId: OwnerId = GUEST): Task[] | undefined {
  return useLiveQuery(() => listTasks({ ownerId }), [ownerId])
}

export type LegacyImportStatus = 'running' | 'blocked' | 'done' | 'failed'

// One run per page load, shared by every component that asks (and by React
// Strict Mode's double effect in development).
let importRun: Promise<unknown> | null = null
const listeners = new Set<() => void>()
let currentStatus: LegacyImportStatus = 'running'

function setStatus(status: LegacyImportStatus) {
  currentStatus = status
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getStatus = () => currentStatus
// The server render never imports anything.
const getServerStatus = (): LegacyImportStatus => 'running'

/**
 * Starts the one-time legacy import and reports its status. `blocked` means
 * an old tab of the app is holding the old database open; the import resumes
 * by itself once that tab closes. A failed import keeps the source, so the
 * next visit retries it.
 */
export function useLegacyImport(): LegacyImportStatus {
  useEffect(() => {
    importRun ??= runLegacyImport({ onBlocked: () => setStatus('blocked') })
      .then(() => setStatus('done'))
      .catch((error) => {
        console.error('Bringing over tasks from the old version failed; it will retry on the next visit.', error)
        setStatus('failed')
      })
  }, [])

  return useSyncExternalStore(subscribe, getStatus, getServerStatus)
}

/** Stats over every live task for the owner; `undefined` while loading. */
export function useStats(ownerId: OwnerId = GUEST): TaskStats | undefined {
  const tasks = useTasks(ownerId)
  return useMemo(() => (tasks ? computeStats(tasks) : undefined), [tasks])
}
