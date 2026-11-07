import type { TasksDB } from './db'
import type { OwnerId, Task, UndoToken } from './types'
import { getDb } from './db'
import { GUEST } from './types'

/**
 * Every write here is one Dexie `rw` transaction that reads the current row
 * before changing it. IndexedDB serialises overlapping readwrite
 * transactions, so a delete or an edit from another tab can't commit between
 * this read and this write. Dexie's transaction promise resolves only after
 * commit and rejects if the transaction aborts.
 */

/**
 * The longest title you can type. Tasks brought over from the old app may be
 * longer, because it had no limit, and they're kept whole (Codex review 5).
 * An edit may keep or shorten such a title, but never grow it.
 */
export const MAX_TITLE_LENGTH = 500

export class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Task not found: ${id}`)
    this.name = 'TaskNotFoundError'
  }
}

export class TitleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TitleError'
  }
}

function cleanTitle(title: string, allowedLength = MAX_TITLE_LENGTH): string {
  const trimmed = title.trim()
  if (!trimmed)
    throw new TitleError('A task needs a title.')
  if (trimmed.length > allowedLength)
    throw new TitleError(`A task title can be at most ${allowedLength} characters.`)
  return trimmed
}

export interface NewTask {
  title: string
  completed?: boolean
  dueDate?: string | null
}

export async function add(input: NewTask, { db = getDb(), ownerId = GUEST }: { db?: TasksDB, ownerId?: OwnerId } = {}): Promise<Task> {
  const now = Date.now()
  const completed = input.completed ?? false
  const task: Task = {
    id: crypto.randomUUID(),
    ownerId,
    title: cleanTitle(input.title),
    completed,
    dueDate: input.dueDate ?? null,
    isSample: 0,
    dirty: 1,
    rev: 1,
    createdAt: now,
    updatedAt: now,
    completedAt: completed ? now : null,
    deletedAt: null,
  }
  await db.tasks.add(task)
  return task
}

export interface TaskPatch {
  title?: string
  completed?: boolean
  dueDate?: string | null
}

/**
 * Applies `patch` to a live task. Rejects with `TaskNotFoundError` if the task
 * is missing or tombstoned, so an edit can never bring a deleted task back.
 * Changing a sample's title or due date makes it yours (decision 5); just
 * completing it doesn't.
 */
export async function update(id: string, patch: TaskPatch, { db = getDb() }: { db?: TasksDB } = {}): Promise<Task> {
  return db.transaction('rw', db.tasks, async () => {
    const current = await db.tasks.get(id)
    if (!current || current.deletedAt !== null)
      throw new TaskNotFoundError(id)

    const now = Date.now()
    const next: Task = { ...current, updatedAt: now, dirty: 1, rev: current.rev + 1 }

    if (patch.title !== undefined) {
      next.title = cleanTitle(patch.title, Math.max(MAX_TITLE_LENGTH, current.title.length))
      if (next.title !== current.title)
        next.isSample = 0
    }
    if (patch.dueDate !== undefined && patch.dueDate !== current.dueDate) {
      next.dueDate = patch.dueDate
      next.isSample = 0
    }
    if (patch.completed !== undefined && patch.completed !== current.completed) {
      next.completed = patch.completed
      next.completedAt = patch.completed ? now : null
    }

    await db.tasks.put(next)
    return next
  })
}

/**
 * Tombstones a task: sets `deletedAt` and keeps the row, so the delete can be
 * undone and, from Phase 9, synced. Returns a one-shot undo token, or null if
 * the task was already deleted or never existed.
 */
export async function remove(id: string, { db = getDb() }: { db?: TasksDB } = {}): Promise<UndoToken | null> {
  return db.transaction('rw', db.tasks, async () => {
    const current = await db.tasks.get(id)
    if (!current || current.deletedAt !== null)
      return null

    const now = Date.now()
    const rev = current.rev + 1
    await db.tasks.put({ ...current, deletedAt: now, updatedAt: now, dirty: 1, rev })
    return { id, rev }
  })
}

/**
 * Undoes one delete. It clears only `deletedAt` and never writes back a
 * remembered copy, so it can't overwrite an edit made in another tab. It
 * matches on the `rev` the delete produced, so a token works once, and a
 * token from an older delete can't undo a newer one. Returns whether anything
 * was restored.
 */
export async function undoRemove(token: UndoToken, { db = getDb() }: { db?: TasksDB } = {}): Promise<boolean> {
  return db.transaction('rw', db.tasks, async () => {
    const current = await db.tasks.get(token.id)
    if (!current || current.deletedAt === null || current.rev !== token.rev)
      return false

    await db.tasks.put({ ...current, deletedAt: null, updatedAt: Date.now(), dirty: 1, rev: current.rev + 1 })
    return true
  })
}

/**
 * Tombstones every live task still marked as a sample. Edited samples aren't
 * marked any more (see `update`), so this never deletes something you've
 * worked on. Returns how many were cleared.
 */
export async function clearSamples({ db = getDb(), ownerId = GUEST }: { db?: TasksDB, ownerId?: OwnerId } = {}): Promise<number> {
  return db.transaction('rw', db.tasks, async () => {
    const samples = await db.tasks
      .where('isSample')
      .equals(1)
      .filter(task => task.ownerId === ownerId && task.deletedAt === null)
      .toArray()
    const now = Date.now()
    await db.tasks.bulkPut(samples.map(task => ({ ...task, deletedAt: now, updatedAt: now, dirty: 1, rev: task.rev + 1 })))
    return samples.length
  })
}

/** Live (not tombstoned) tasks for `ownerId`, newest first. */
export async function listTasks({ db = getDb(), ownerId = GUEST }: { db?: TasksDB, ownerId?: OwnerId } = {}): Promise<Task[]> {
  const tasks = await db.tasks
    .where('ownerId')
    .equals(ownerId)
    .filter(task => task.deletedAt === null)
    .toArray()
  return sortNewestFirst(tasks)
}

/** Newest first, ties broken by id so the order is stable across renders. */
export function sortNewestFirst(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
}
