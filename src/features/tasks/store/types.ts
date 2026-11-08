/** Who a task belongs to: this device's guest, or a Supabase user id (Phase 9). */
export type OwnerId = 'guest' | (string & {})

export const GUEST: OwnerId = 'guest'

/**
 * A task as stored in IndexedDB.
 *
 * `isSample` and `dirty` are `0 | 1`, not booleans, because booleans aren't
 * valid IndexedDB keys and both fields are indexed. Timestamps are epoch ms.
 * `rev` goes up by one on every local write. Undo tokens use it now, and push
 * acknowledgement uses it in Phase 10, because two writes can land in the same
 * millisecond and share a timestamp.
 */
export interface Task {
  id: string
  ownerId: OwnerId
  title: string
  completed: boolean
  /** A local calendar date, `YYYY-MM-DD`, or null for no due date. */
  dueDate: string | null
  isSample: 0 | 1
  dirty: 0 | 1
  rev: number
  createdAt: number
  updatedAt: number
  completedAt: number | null
  /** Set when deleted. A tombstone is never cleared except by its own undo. */
  deletedAt: number | null
  /**
   * The rev the delete produced, kept apart from `rev` so later writes to a
   * tombstone (a label being deleted, sync bookkeeping) can't invalidate its
   * Undo token (review of Phase 7). Absent on rows deleted before it.
   */
  deletedRev?: number | null
  /** 1 when flagged Vital (Phase 7): sorted first within its date group. */
  vital: 0 | 1
  /** Ids of the labels on this task (Phase 7). Unknown ids are ignored when shown. */
  categoryIds: string[]
  /**
   * The server's `server_updated_at` for the version this row last took from
   * the server (Phase 10). A pull or acknowledgement only applies a strictly
   * newer one, so a delayed response can't overwrite a newer synced version.
   */
  serverStamp?: string | null
}

/** A label the user creates (Phase 7). Same sync fields as a task. */
export interface Category {
  id: string
  ownerId: OwnerId
  name: string
  color: CategoryColor
  dirty: 0 | 1
  rev: number
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  /** As on Task: the server version this row last took. */
  serverStamp?: string | null
}

export const CATEGORY_COLORS = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'] as const
export type CategoryColor = (typeof CATEGORY_COLORS)[number]

export interface MetaEntry {
  key: string
  value: unknown
}

/** Returned by `remove()`. One-shot: it can only undo the delete it came from. */
export interface UndoToken {
  id: string
  /** The delete's generation: the row's `deletedRev`. */
  rev: number
}
