/** Who a task belongs to: this device's guest, or a Supabase user id (Phase 8). */
export type OwnerId = 'guest' | (string & {})

export const GUEST: OwnerId = 'guest'

/**
 * A task as stored in IndexedDB.
 *
 * `isSample` and `dirty` are `0 | 1`, not booleans, because booleans aren't
 * valid IndexedDB keys and both fields are indexed. Timestamps are epoch ms.
 * `rev` goes up by one on every local write. Undo tokens use it now, and push
 * acknowledgement uses it in Phase 9, because two writes can land in the same
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
}

export interface MetaEntry {
  key: string
  value: unknown
}

/** Returned by `remove()`. One-shot: it can only undo the delete it came from. */
export interface UndoToken {
  id: string
  rev: number
}
