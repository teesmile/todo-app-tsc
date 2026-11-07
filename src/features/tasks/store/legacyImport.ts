import type { TasksDB } from './db'
import type { Task } from './types'
import Dexie from 'dexie'
import { v5 as uuidv5 } from 'uuid'
import { getDb, getInstallId } from './db'
import { GUEST } from './types'

/**
 * Brings tasks over from the pre-v1 database, `TodoAppDB` (version 1, store
 * `todos`), without ever losing one (reviews 1 and 2).
 *
 * 1. Cut over first. Opening `TodoAppDB` at version 2 can only run once every
 *    version-1 connection has closed. Old tabs ignore `versionchange`, so
 *    they block it, and `onBlocked` fires. Once the database is at version 2,
 *    old code can never open it again (its version-1 request fails with
 *    VersionError), so no legacy write can land after the snapshot below.
 * 2. Snapshot the rows that are the user's: everything they created, plus
 *    dummyjson rows they changed since the last sync. Skip tombstones.
 * 3. Insert only. Ids are UUID v5s of the old id, namespaced by this
 *    database's installId: valid for the server's uuid key, the same on every
 *    retry, and different on every other device. An id that's already there
 *    (another tab, an earlier interrupted run) is skipped, never overwritten.
 * 4. Record `importedAt` in the source only after the destination committed,
 *    and never delete the source.
 */

export const LEGACY_DB_NAME = 'TodoAppDB'
const CUTOVER_VERSION = 2
const CUTOVER_STORE = 'cutover'
const CUTOVER_KEY = 'state'

export interface LegacyTodo {
  id: number
  todo: string
  completed: boolean
  isLocal?: boolean
  createdAt?: Date | string | number
  updatedAt?: Date | string | number
  deletedAt?: Date | string | number | null
}

export type LegacyImportResult
  = | { status: 'no-legacy-db' }
    | { status: 'already-imported' }
    | { status: 'imported', imported: number, skipped: number }

function toMs(value: LegacyTodo['createdAt']): number | null {
  if (value === undefined || value === null)
    return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Rows that are the user's: created by them, or changed by them since the last sync. */
export function selectUserRows(rows: LegacyTodo[]): LegacyTodo[] {
  return rows.filter((row) => {
    if (row.deletedAt)
      return false
    if (row.isLocal === true)
      return true
    const created = toMs(row.createdAt)
    const updated = toMs(row.updatedAt)
    return created !== null && updated !== null && updated > created
  })
}

export function legacyTaskId(oldId: number, installId: string): string {
  return uuidv5(String(oldId), installId)
}

export function mapLegacyRow(row: LegacyTodo, installId: string, now = Date.now()): Task {
  const createdAt = toMs(row.createdAt) ?? now
  const updatedAt = toMs(row.updatedAt) ?? createdAt
  const title = row.todo?.trim() || 'Untitled task'
  return {
    id: legacyTaskId(row.id, installId),
    ownerId: GUEST,
    // Kept whole, however long: the old app had no limit (review 5).
    title,
    completed: Boolean(row.completed),
    dueDate: null,
    isSample: 0,
    dirty: 1,
    rev: 1,
    createdAt,
    updatedAt,
    completedAt: row.completed ? updatedAt : null,
    deletedAt: null,
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'))
    tx.onerror = () => reject(tx.error)
  })
}

/** Opens `TodoAppDB` at the cutover version, or resolves null if it never existed. */
function openForCutover(factory: IDBFactory, onBlocked: () => void): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    let neverExisted = false
    const req = factory.open(LEGACY_DB_NAME, CUTOVER_VERSION)
    req.onupgradeneeded = (event) => {
      const db = req.result
      if (event.oldVersion === 0) {
        // Nothing to import. Abort, so no empty TodoAppDB is left behind.
        neverExisted = true
        req.transaction?.abort()
        return
      }
      if (!db.objectStoreNames.contains(CUTOVER_STORE))
        db.createObjectStore(CUTOVER_STORE, { keyPath: 'key' })
    }
    req.onblocked = () => onBlocked()
    req.onsuccess = () => {
      const db = req.result
      // Be the good citizen the old code wasn't: never block a later upgrade.
      db.onversionchange = () => db.close()
      resolve(db)
    }
    req.onerror = (event) => {
      if (neverExisted) {
        event.preventDefault()
        resolve(null)
      }
      else {
        reject(req.error)
      }
    }
  })
}

export interface LegacyImportOptions {
  db?: TasksDB
  factory?: IDBFactory
  /** Called if old tabs are holding `TodoAppDB` open, so the cutover has to wait. */
  onBlocked?: () => void
}

export async function runLegacyImport({ db = getDb(), factory = globalThis.indexedDB, onBlocked = () => {} }: LegacyImportOptions = {}): Promise<LegacyImportResult> {
  const legacy = await openForCutover(factory, onBlocked)
  if (!legacy)
    return { status: 'no-legacy-db' }

  try {
    if (!legacy.objectStoreNames.contains('todos') || !legacy.objectStoreNames.contains(CUTOVER_STORE))
      return { status: 'no-legacy-db' }

    const readTx = legacy.transaction(['todos', CUTOVER_STORE], 'readonly')
    const [state, rows] = await Promise.all([
      request(readTx.objectStore(CUTOVER_STORE).get(CUTOVER_KEY)) as Promise<{ importedAt?: number } | undefined>,
      request(readTx.objectStore('todos').getAll()) as Promise<LegacyTodo[]>,
    ])
    if (state?.importedAt)
      return { status: 'already-imported' }

    const installId = await getInstallId(db)
    const tasks = selectUserRows(rows).map(row => mapLegacyRow(row, installId))

    let skipped = 0
    try {
      await db.tasks.bulkAdd(tasks)
    }
    catch (error) {
      if (!(error instanceof Dexie.BulkError))
        throw error
      // Rows from an earlier run or another tab are already there: insert-only
      // means skip them, so an edit made after that import survives.
      const failures = error.failures
      if (failures.some(failure => failure.name !== 'ConstraintError'))
        throw error
      skipped = failures.length
    }

    // Only now that the destination has committed.
    const writeTx = legacy.transaction(CUTOVER_STORE, 'readwrite')
    writeTx.objectStore(CUTOVER_STORE).put({ key: CUTOVER_KEY, importedAt: Date.now() })
    await done(writeTx)

    return { status: 'imported', imported: tasks.length - skipped, skipped }
  }
  finally {
    legacy.close()
  }
}
