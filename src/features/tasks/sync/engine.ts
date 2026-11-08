import type { EntityTable } from 'dexie'
import type { TasksDB } from '../store/db'
import type { Category, Task } from '../store/types'
import type { Outgoing, Remote, ServerCategory, ServerRows, ServerTask, SyncTable } from './types'
import { UNDO_WINDOW_MS } from '../store/repository'
import { isUndoHeld } from '../store/undoHolds'
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

/**
 * A tombstone whose Undo can still happen on this device: inside its window,
 * or its toast is still on screen here (paused toasts included).
 */
function undoable(row: LocalRow, now: number) {
  return 'deletedRev' in row && row.deletedAt !== null && row.deletedRev != null
    && (row.deletedAt > now - UNDO_WINDOW_MS || isUndoHeld(row.id))
}

/** Whether `row` is a strictly newer server version than the one `local` holds. */
function newerThanLocal(row: { server_updated_at: string }, local: LocalRow) {
  return !local.serverStamp || compareStamps(row.server_updated_at, local.serverStamp) > 0
}

/**
 * This account's sync generation on this device. Sign-out and account
 * deletion delete it, so a run that started before them finds it changed
 * inside its next transaction and stops without writing (review 11).
 */
export function epochKey(userId: string) {
  return `syncEpoch:${userId}`
}

export class SyncCancelledError extends Error {
  constructor() {
    super('Sync stopped: the account signed out on this device')
    this.name = 'SyncCancelledError'
  }
}

async function startEpoch(db: TasksDB, userId: string): Promise<string> {
  return db.transaction('rw', db.meta, async () => {
    const current = (await db.meta.get(epochKey(userId)))?.value
    if (typeof current === 'string')
      return current
    const fresh = crypto.randomUUID()
    await db.meta.put({ key: epochKey(userId), value: fresh })
    return fresh
  })
}

/** Inside a transaction that includes `meta`: stop if the account signed out since this run began. */
async function assertEpoch(db: TasksDB, userId: string, epoch: string) {
  if ((await db.meta.get(epochKey(userId)))?.value !== epoch)
    throw new SyncCancelledError()
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

interface Run extends SyncContext {
  epoch: string
}

/**
 * Sends this user's dirty rows and acknowledges them in one transaction per
 * batch. Each batch is re-read in a transaction just before it's sent: rows
 * undone or changed since are sent as they are now, and a delete being sent
 * loses its undo token there, so an Undo can never succeed while that delete
 * is in flight (review 11). On acknowledgement, a row whose `rev`
 * hasn't moved becomes the server's row (its winning fields, its clamped
 * `updatedAt`, its tombstone) and is clean; a row edited meanwhile stays
 * dirty for next time and only adopts the server's tombstone. Returns when
 * the earliest held-back tombstone leaves its undo window, or null.
 */
async function push<T extends SyncTable>(name: T, { db, remote, userId, epoch, now = Date.now, batchSize = PUSH_BATCH_SIZE }: Run, { flushUndo = false } = {}): Promise<number | null> {
  const spec = specs[name] as Spec<T>
  const table = spec.table(db)
  const candidates = await table.where('[ownerId+dirty]').equals([userId, 1]).primaryKeys()
  let heldUntil: number | null = null

  for (let i = 0; i < candidates.length; i += batchSize) {
    const ids = candidates.slice(i, i + batchSize)
    const batch = await db.transaction('rw', table, db.meta, async () => {
      await assertEpoch(db, userId, epoch)
      const at = now()
      const ready: LocalRow[] = []
      for (const row of await table.bulkGet(ids)) {
        if (!row || row.ownerId !== userId || row.dirty !== 1 || spec.unsendable?.(row))
          continue
        if (!flushUndo && undoable(row, at)) {
          const until = Math.max(row.deletedAt! + UNDO_WINDOW_MS, at + 1000)
          heldUntil = heldUntil === null ? until : Math.min(heldUntil, until)
          continue
        }
        if ('deletedRev' in row && row.deletedAt !== null && row.deletedRev != null) {
          // Retire the undo token before the delete leaves; rev is unchanged,
          // so the acknowledgement below still recognises the row.
          const sending = { ...row, deletedRev: null }
          await table.put(sending)
          ready.push(sending)
        }
        else {
          ready.push(row)
        }
      }
      return ready
    })
    if (batch.length === 0)
      continue
    const sentRev = new Map(batch.map(row => [row.id, row.rev]))
    const stored = await remote.push(name, batch.map(row => spec.toServer(row, userId)))
    await db.transaction('rw', table, db.meta, async () => {
      await assertEpoch(db, userId, epoch)
      for (const row of stored) {
        const local = await table.get(row.id)
        if (!local)
          continue
        if (local.rev === sentRev.get(row.id)) {
          if (newerThanLocal(row, local))
            await table.put(spec.fromServer(row, local))
        }
        else if (row.deleted_at !== null) {
          await table.put(adoptTombstone(local, row.deleted_at))
        }
      }
    })
  }
  return heldUntil
}

/**
 * Brings in rows stamped since the cursor (minus the overlap), page by page
 * in (server_updated_at, id) order, each page applied in one transaction
 * that also moves the cursor. Applying is idempotent, so the overlap is
 * harmless. Unknown ids are added; clean rows take the server's version only
 * if it's newer than the one they hold, so a pull delayed behind another
 * tab's sync can't put an older version back (review 11); dirty rows
 * are left for their push to settle, except that a server tombstone wins.
 */
async function pull<T extends SyncTable>(name: T, { db, remote, userId, epoch, pageSize = PULL_PAGE_SIZE }: Run): Promise<number> {
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
      await assertEpoch(db, userId, epoch)
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
          if (newerThanLocal(row, local))
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
  const run: Run = { ...context, epoch: await startEpoch(context.db, context.userId) }
  const heldCategories = await push('categories', run)
  const heldTasks = await push('tasks', run)
  const pulled = await pull('categories', run) + await pull('tasks', run)
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
  const run: Run = { ...context, epoch: await startEpoch(context.db, context.userId) }
  await push('categories', run, { flushUndo: true })
  await push('tasks', run, { flushUndo: true })
}
