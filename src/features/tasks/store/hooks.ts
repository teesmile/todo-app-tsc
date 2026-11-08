'use client'

import type { TaskStats } from './stats'
import type { Category, OwnerId, Task } from './types'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useToday } from '../hooks/useToday'
import { runLegacyImport } from './legacyImport'
import { listCategories, listTasks } from './repository'
import { computeStats } from './stats'
import { GUEST } from './types'

/**
 * Live, newest-first tasks for the current owner. `undefined` means still
 * loading, and `[]` means there are no tasks, so the empty state never
 * flashes on load. The query re-runs whenever a write touches the rows it
 * read, including writes from another tab.
 */
export function useTasks(ownerId: OwnerId | null = GUEST): Task[] | undefined {
  return useLiveQuery(() => (ownerId === null ? undefined : listTasks({ ownerId })), [ownerId])
}

/** Live labels, by name; `undefined` while loading. */
export function useCategories(ownerId: OwnerId | null = GUEST): Category[] | undefined {
  return useLiveQuery(() => (ownerId === null ? undefined : listCategories({ ownerId })), [ownerId])
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

// Only the latest run may set the status: an earlier run that settles late
// (a retry started while it was pending) must not overwrite a newer result.
let generation = 0

function startImport(): Promise<unknown> {
  const run = ++generation
  const settle = (status: LegacyImportStatus) => {
    if (run === generation)
      setStatus(status)
  }
  setStatus('running')
  importRun = runLegacyImport({ onBlocked: () => settle('blocked') })
    .then(() => settle('done'))
    .catch((error) => {
      console.error('Bringing over tasks from the old version failed. The old data is untouched.', error)
      settle('failed')
    })
  return importRun
}

/**
 * Runs the import again after a failure, without a reload. Safe to call any
 * number of times: the import is insert-only, and it does nothing once
 * `importedAt` is recorded.
 */
export function retryLegacyImport(): Promise<unknown> {
  return startImport()
}

/** Forgets the shared run and status. Tests only. */
export function resetLegacyImportForTests(): void {
  generation += 1
  importRun = null
  currentStatus = 'running'
}

/**
 * Starts the one-time legacy import and reports its status. `blocked` means
 * an old tab of the app is holding the old database open; the import resumes
 * by itself once that tab closes. `failed` means nothing was lost: the source
 * is kept, and `retryLegacyImport` (or the next visit) tries again.
 */
export function useLegacyImport(): LegacyImportStatus {
  useEffect(() => {
    if (!importRun)
      startImport()
  }, [])

  return useSyncExternalStore(subscribe, getStatus, getServerStatus)
}

/** Stats over every live task for the owner; `undefined` while loading. */
export function useStats(ownerId: OwnerId | null = GUEST): TaskStats | undefined {
  const tasks = useTasks(ownerId)
  const today = useToday()
  return useMemo(() => (tasks ? computeStats(tasks, today) : undefined), [tasks, today])
}
