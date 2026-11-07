import type { TasksDB } from './db'
import type { Category, CategoryColor, OwnerId, Task, UndoToken } from './types'
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
 * longer, because it had no limit, and they're kept whole (review 5).
 * An edit may keep or shorten such a title, but never grow it.
 */
export const MAX_TITLE_LENGTH = 500

export class TaskNotFoundError extends Error {
  constructor(id: string) {
    super(`Task not found: ${id}`)
    this.name = 'TaskNotFoundError'
  }
}

/**
 * The title changed since an edit began, typically in another tab. Carries
 * the stored title so the editor can say what it is and let the user choose.
 */
export class TitleConflictError extends Error {
  constructor(readonly currentTitle: string) {
    super(`The title changed to "${currentTitle}" since editing began`)
    this.name = 'TitleConflictError'
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
  vital?: boolean
  categoryIds?: string[]
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
    vital: input.vital ? 1 : 0,
    categoryIds: [...new Set(input.categoryIds ?? [])],
  }
  await db.tasks.add(task)
  return task
}

export interface TaskPatch {
  title?: string
  completed?: boolean
  dueDate?: string | null
  vital?: boolean
  categoryIds?: string[]
}

/**
 * Applies `patch` to a live task. Rejects with `TaskNotFoundError` if the task
 * is missing or tombstoned, so an edit can never bring a deleted task back.
 * Changing a sample's title or due date makes it yours (decision 5); just
 * completing it doesn't.
 */
export async function update(id: string, patch: TaskPatch, { db = getDb(), expectTitle }: { db?: TasksDB, expectTitle?: string } = {}): Promise<Task> {
  return db.transaction('rw', db.tasks, async () => {
    const current = await db.tasks.get(id)
    if (!current || current.deletedAt !== null)
      throw new TaskNotFoundError(id)
    // Compare-and-set: an edit made against an older title must not
    // silently overwrite a newer one (review of Phases 4-6).
    if (expectTitle !== undefined && current.title !== expectTitle)
      throw new TitleConflictError(current.title)

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
    if (patch.vital !== undefined)
      next.vital = patch.vital ? 1 : 0
    if (patch.categoryIds !== undefined)
      next.categoryIds = [...new Set(patch.categoryIds)]

    await db.tasks.put(next)
    return next
  })
}

/**
 * Tombstones a task: sets `deletedAt` and keeps the row, so the delete can be
 * undone and, from Phase 10, synced. Returns a one-shot undo token, or null if
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
 * worked on. Returns one undo token per cleared task, so the whole clear can
 * be undone.
 */
export async function clearSamples({ db = getDb(), ownerId = GUEST }: { db?: TasksDB, ownerId?: OwnerId } = {}): Promise<UndoToken[]> {
  return db.transaction('rw', db.tasks, async () => {
    const samples = await db.tasks
      .where('isSample')
      .equals(1)
      .filter(task => task.ownerId === ownerId && task.deletedAt === null)
      .toArray()
    const now = Date.now()
    await db.tasks.bulkPut(samples.map(task => ({ ...task, deletedAt: now, updatedAt: now, dirty: 1, rev: task.rev + 1 })))
    return samples.map(task => ({ id: task.id, rev: task.rev + 1 }))
  })
}

/** How long a delete can be undone, in ms. The toast shows for this long. */
export const UNDO_WINDOW_MS = 6000

/**
 * How long a guest tombstone is kept before the boot-time purge removes it.
 * Much longer than the undo window: the toast pauses on hover or focus, and
 * another tab's boot must not delete a row that a paused Undo still points
 * at (review of Phases 4-6). Guest tombstones cost almost nothing.
 */
export const TOMBSTONE_RETENTION_MS = 24 * 60 * 60 * 1000

/**
 * Hard-deletes guest tombstones older than TOMBSTONE_RETENTION_MS. A guest's
 * tombstone is only kept for undo, because nothing will ever sync it. A
 * signed-in user's tombstones are left alone: sync needs them so a delete
 * doesn't come back from another device (Phase 10). Returns how many went.
 */
export async function purgeGuestTombstones({ db = getDb(), now = Date.now() }: { db?: TasksDB, now?: number } = {}): Promise<number> {
  return db.transaction('rw', db.tasks, async () => {
    const expired = await db.tasks
      .where('ownerId')
      .equals(GUEST)
      .filter(task => task.deletedAt !== null && task.deletedAt < now - TOMBSTONE_RETENTION_MS)
      .primaryKeys()
    await db.tasks.bulkDelete(expired)
    return expired.length
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

// Labels (Phase 7) -----------------------------------------------------------

export const MAX_CATEGORY_NAME_LENGTH = 40

export class CategoryNameError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CategoryNameError'
  }
}

async function liveCategories(db: TasksDB, ownerId: OwnerId): Promise<Category[]> {
  return db.categories.where('ownerId').equals(ownerId).filter(c => c.deletedAt === null).toArray()
}

/** Trimmed, 1–40 characters, and not already used by another live label (ignoring case). */
async function cleanCategoryName(db: TasksDB, ownerId: OwnerId, name: string, exceptId?: string): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed)
    throw new CategoryNameError('A label needs a name.')
  if (trimmed.length > MAX_CATEGORY_NAME_LENGTH)
    throw new CategoryNameError(`A label name can be at most ${MAX_CATEGORY_NAME_LENGTH} characters.`)
  const clash = (await liveCategories(db, ownerId)).find(c => c.id !== exceptId && c.name.toLowerCase() === trimmed.toLowerCase())
  if (clash)
    throw new CategoryNameError(`There's already a label called "${clash.name}".`)
  return trimmed
}

export async function createCategory(input: { name: string, color: CategoryColor }, { db = getDb(), ownerId = GUEST }: { db?: TasksDB, ownerId?: OwnerId } = {}): Promise<Category> {
  return db.transaction('rw', db.categories, async () => {
    const now = Date.now()
    const category: Category = {
      id: crypto.randomUUID(),
      ownerId,
      name: await cleanCategoryName(db, ownerId, input.name),
      color: input.color,
      dirty: 1,
      rev: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    await db.categories.add(category)
    return category
  })
}

export async function updateCategory(id: string, patch: { name?: string, color?: CategoryColor }, { db = getDb() }: { db?: TasksDB } = {}): Promise<Category> {
  return db.transaction('rw', db.categories, async () => {
    const current = await db.categories.get(id)
    if (!current || current.deletedAt !== null)
      throw new CategoryNameError('That label no longer exists.')
    const next: Category = { ...current, updatedAt: Date.now(), dirty: 1, rev: current.rev + 1 }
    if (patch.name !== undefined)
      next.name = await cleanCategoryName(db, current.ownerId, patch.name, id)
    if (patch.color !== undefined)
      next.color = patch.color
    await db.categories.put(next)
    return next
  })
}

/**
 * Tombstones a label and takes it off every task that has it, in one
 * transaction, so no task is left pointing at it. Returns how many tasks
 * changed.
 */
export async function removeCategory(id: string, { db = getDb() }: { db?: TasksDB } = {}): Promise<number> {
  return db.transaction('rw', db.categories, db.tasks, async () => {
    const current = await db.categories.get(id)
    if (!current || current.deletedAt !== null)
      return 0
    const now = Date.now()
    await db.categories.put({ ...current, deletedAt: now, updatedAt: now, dirty: 1, rev: current.rev + 1 })
    const tasks = await db.tasks.where('categoryIds').equals(id).toArray()
    await db.tasks.bulkPut(tasks.map(task => ({ ...task, categoryIds: task.categoryIds.filter(c => c !== id), updatedAt: now, dirty: 1, rev: task.rev + 1 })))
    return tasks.filter(t => t.deletedAt === null).length
  })
}

/** Live labels for `ownerId`, by name. */
export async function listCategories({ db = getDb(), ownerId = GUEST }: { db?: TasksDB, ownerId?: OwnerId } = {}): Promise<Category[]> {
  return (await liveCategories(db, ownerId)).sort((a, b) => a.name.localeCompare(b.name))
}
