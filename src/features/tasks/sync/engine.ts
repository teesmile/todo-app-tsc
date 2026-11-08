import type { EntityTable } from 'dexie'
import type { TasksDB } from '../store/db'
import type { Category, Task } from '../store/types'
import type { Outgoing, Remote, ServerCategory, ServerRows, ServerTask, SyncTable } from './types'
import { UNDO_WINDOW_MS } from '../store/repository'
import { categoryFromServer, categoryToServer, SERVER_MAX_TITLE_LENGTH, taskFromServer, taskToServer } from './mapping'
import { compareStamps, iso, ms } from './time'

/**
 * Sync for one signed-in user, in both directions, for labels then tasks.
 *
 * The UI never calls this and never reads the server: it writes to Dexie,
 * and live queries show whatever this applies. Conflicts are decided only by
 * the server's trigger (last write wins, tombstones are final); this module
 * never compares timestamps between devices, it adopts the server's answer.
 */

/** Pull this far behind the cursor: covers a write stamped before the cursor that committed after it (the 8s statement timeout bounds that). */
export const PULL_OVERLAP_MS = 60_000
export const PUSH_BATCH_SIZE = 100
export const PULL_PAGE_SIZE = 200
/** Synced tombstones are dropped from the device after this. The server keeps them forever. */
export const SYNCED_TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

type LocalRow = Task | Category

interface Spec<T extends SyncTable> {
  table: (db: TasksDB) => EntityTable<LocalRow, 'id'>
  toServer: (row: LocalRow, userId: string) => Outgoing<T>
  fromServer: (row: ServerRows[T], local?: LocalRow) => LocalRow
  /** Rows that can't be sent at all (a title over the server's limit). */
  unsendable?: (row: LocalRow) => boolean
}

const specs: { [T in SyncTable]: Spec<T> } = {
  categories: {
    table: db => db.categories as unknown as EntityTable<LocalRow, 'id'>,
    toServer: (row, userId) => categoryToServer(row as Category, userId),
    fromServer: (row, local) => categoryFromServer(row as ServerCategory, local as Category | undefined),
  },
  tasks: {
    table: db => db.tasks as unknown as EntityTable<LocalRow, 'id'>,
    toServer: (row, userId) => taskToServer(row as Task, userId),
    fromServer: (row, local) => taskFromServer(row as ServerTask, local as Task | undefined),
    unsendable: row => (row as Task).title.length > SERVER_MAX_TITLE_LENGTH,
  },
}

export function cursorKey(userId: string, table: SyncTable) {
  return `syncCursor:${userId}:${table}`
}

/** A tombstone whose Undo can still happen on this device: it stays here until its window ends. */
function inUndoWindow(row: LocalRow, now: number) {
  return 'deletedRev' in row && row.deletedAt !== null && row.deletedRev != null && row.deletedAt > now - UNDO_WINDOW_MS
}

/** The server has the delete: final everywhere, so the local copy loses its undo token. */
function adoptTombstone(local: LocalRow, deletedAt: string): LocalRow {
  return { ...local, deletedAt: local.deletedAt ?? ms(deletedAt), ...('deletedRev' in local ? { deletedRev: null } : {}) }
}

export interface SyncContext {
  db: TasksDB
  remote: Remote
  userId: string
  now?: () => number
  pageSize?: number
  batchSize?: number
}

/**
 * Sends this user's dirty rows and acknowledges them in one transaction per
 * batch. A row whose `rev` hasn't moved since it was sent becomes the
 * server's row (its winning fields, its clamped `updatedAt`, its tombstone)
 * and is clean. A row edited during the push stays dirty for next time and
 * only adopts the server's tombstone. Returns when the earliest held-back
 * tombstone leaves its undo window, or null.
 */
async function push<T extends SyncTable>(name: T, { db, remote, userId, now = Date.now, batchSize = PUSH_BATCH_SIZE }: SyncContext, { flushUndo = false } = {}): Promise<number | null> {
  const spec = specs[name] as Spec<T>
  const table = spec.table(db)
  const dirty = await table.where('[ownerId+dirty]').equals([userId, 1]).toArray()
  const at = now()
  let heldUntil: number | null = null
  const ready = dirty.filter((row) => {
    if (!flushUndo && inUndoWindow(row, at)) {
      const until = row.deletedAt! + UNDO_WINDOW_MS
      heldUntil = heldUntil === null ? until : Math.min(heldUntil, until)
      return false
    }
    return !spec.unsendable?.(row)
  })

  for (let i = 0; i < ready.length; i += batchSize) {
    const batch = ready.slice(i, i + batchSize)
    const sentRev = new Map(batch.map(row => [row.id, row.rev]))
    const stored = await remote.push(name, batch.map(row => spec.toServer(row, userId)))
    await db.transaction('rw', table, async () => {
      for (const row of stored) {
        const local = await table.get(row.id)
        if (!local)
          continue
        if (local.rev === sentRev.get(row.id))
          await table.put(spec.fromServer(row, local))
        else if (row.deleted_at !== null)
          await table.put(adoptTombstone(local, row.deleted_at))
      }
    })
  }
  return heldUntil
}

/**
 * Brings in rows stamped since the cursor (minus the overlap), page by page
 * in (server_updated_at, id) order, each page applied in one transaction
 * that also moves the cursor. Applying is idempotent, so the overlap is
 * harmless. Unknown ids are added; clean rows become the server's; dirty rows
 * are left for their push to settle, except that a server tombstone wins.
 */
async function pull<T extends SyncTable>(name: T, { db, remote, userId, pageSize = PULL_PAGE_SIZE }: SyncContext): Promise<number> {
  const spec = specs[name] as Spec<T>
  const table = spec.table(db)
  const key = cursorKey(userId, name)
  const cursor = (await db.meta.get(key))?.value as string | undefined
  const since = cursor ? iso(ms(cursor) - PULL_OVERLAP_MS) : iso(0)
  let after: { ts: string, id: string } | null = null
  let applied = 0

  for (;;) {
    const rows: ServerRows[T][] = await remote.pull(name, { since, after, limit: pageSize })
    if (rows.length === 0)
      break
    await db.transaction('rw', table, db.meta, async () => {
      for (const row of rows) {
        const local = await table.get(row.id)
        if (!local) {
          // A delete of something this device never had changes nothing here.
          if (row.deleted_at === null)
            await table.add(spec.fromServer(row))
        }
        else if (local.ownerId !== userId) {
          // Never touch another owner's row (a guest's, or another account's).
          continue
        }
        else if (local.dirty === 0) {
          await table.put(spec.fromServer(row, local))
        }
        else if (row.deleted_at !== null) {
          await table.put(adoptTombstone(local, row.deleted_at))
        }
      }
      const pageMax = rows.at(-1)!.server_updated_at
      const stored = (await db.meta.get(key))?.value as string | undefined
      if (!stored || compareStamps(pageMax, stored) > 0)
        await db.meta.put({ key, value: pageMax })
    })
    applied += rows.length
    const last: ServerRows[T] = rows.at(-1)!
    after = { ts: last.server_updated_at, id: last.id }
    if (rows.length < pageSize)
      break
  }
  return applied
}

/** Drops this user's synced tombstones older than 30 days from the device. Reads first, so it usually writes nothing. */
export async function purgeSyncedTombstones(db: TasksDB, userId: string, now = Date.now()): Promise<number> {
  const old = (row: LocalRow) => row.dirty === 0 && row.deletedAt !== null && row.deletedAt < now - SYNCED_TOMBSTONE_RETENTION_MS
  let purged = 0
  for (const table of [db.tasks, db.categories] as unknown as EntityTable<LocalRow, 'id'>[]) {
    if (!await table.where('ownerId').equals(userId).filter(old).first())
      continue
    purged += await db.transaction('rw', table, async () => {
      const ids = await table.where('ownerId').equals(userId).filter(old).primaryKeys()
      await table.bulkDelete(ids)
      return ids.length
    })
  }
  return purged
}

export interface SyncResult {
  pulled: number
  /** When a tombstone held for its undo window can go, or null. */
  retryAt: number | null
}

/** One full sync: push labels, push tasks, pull labels, pull tasks, then tidy old tombstones. */
export async function syncNow(context: SyncContext): Promise<SyncResult> {
  const heldCategories = await push('categories', context)
  const heldTasks = await push('tasks', context)
  const pulled = await pull('categories', context) + await pull('tasks', context)
  await purgeSyncedTombstones(context.db, context.userId, (context.now ?? Date.now)())
  const held = [heldCategories, heldTasks].filter((t): t is number => t !== null)
  return { pulled, retryAt: held.length ? Math.min(...held) : null }
}

/**
 * Only the pushes, deletes in their undo window included: what sign-out runs
 * before it decides what stays on the device. After sign-out nobody can
 * press that Undo, so holding the delete back would only leave it unsynced.
 */
export async function pushAll(context: SyncContext): Promise<void> {
  await push('categories', context, { flushUndo: true })
  await push('tasks', context, { flushUndo: true })
}
