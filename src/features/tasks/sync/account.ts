import type { TasksDB } from '../store/db'
import type { Category, Task } from '../store/types'
import { getDb } from '../store/db'
import { GUEST } from '../store/types'
import { cursorKey, epochKey } from './engine'
import { SERVER_MAX_TITLE_LENGTH } from './mapping'

/** The meta flag that says this device already offered its guest tasks to `userId`. */
export function importOfferedKey(userId: string) {
  return `importOffered:${userId}`
}

export interface ImportCandidates {
  /** Live guest tasks that aren't samples. */
  own: number
  /** Live guest tasks still marked as samples. */
  samples: number
  /** Titles over the server's limit, possible only from the old app: they stay here as guest tasks. */
  tooLong: string[]
}

/** What "Add N tasks from this device" would bring over. Tombstones are never offered. */
export async function importCandidates({ db = getDb() }: { db?: TasksDB } = {}): Promise<ImportCandidates> {
  const live = await db.tasks.where('ownerId').equals(GUEST).filter(t => t.deletedAt === null).toArray()
  const tooLong = live.filter(t => t.title.length > SERVER_MAX_TITLE_LENGTH)
  const fits = live.filter(t => t.title.length <= SERVER_MAX_TITLE_LENGTH)
  return {
    own: fits.filter(t => t.isSample === 0).length,
    samples: fits.filter(t => t.isSample === 1).length,
    tooLong: tooLong.map(t => t.title),
  }
}

/**
 * Moves this device's live guest tasks into the account, in one transaction:
 * same ids (so a retry can't duplicate), `ownerId` set, marked dirty so they
 * push. Samples move only if asked; an over-long title stays behind as a
 * guest task, never truncated. Also records that the offer was answered.
 *
 * Each guest label the moving tasks use comes with them without being taken
 * from the tasks that stay (review 11): mapped to the account's label
 * of the same name if there is one, copied to a new account label if guest
 * tasks staying behind still use it, and otherwise moved as it is.
 */
export async function importGuestTasks(userId: string, { includeSamples = false, db = getDb() }: { includeSamples?: boolean, db?: TasksDB } = {}): Promise<number> {
  return db.transaction('rw', db.tasks, db.categories, db.meta, async () => {
    const guestTasks = await db.tasks.where('ownerId').equals(GUEST).filter(t => t.deletedAt === null).toArray()
    const moves = (t: Task) => t.title.length <= SERVER_MAX_TITLE_LENGTH && (includeSamples || t.isSample === 0)
    const moving = guestTasks.filter(moves)
    const staying = guestTasks.filter(t => !moves(t))
    const usedByStaying = new Set(staying.flatMap(t => t.categoryIds))
    const accountLabels = await db.categories.where('ownerId').equals(userId).filter(c => c.deletedAt === null).toArray()
    const accountByName = new Map(accountLabels.map(c => [c.name.toLowerCase(), c.id]))

    const labelIds = new Set(moving.flatMap(t => t.categoryIds))
    const guestLabels = await db.categories.where('ownerId').equals(GUEST).filter(c => c.deletedAt === null && labelIds.has(c.id)).toArray()
    const remap = new Map<string, string>()
    const now = Date.now()
    for (const label of guestLabels) {
      const existing = accountByName.get(label.name.toLowerCase())
      if (existing) {
        remap.set(label.id, existing)
      }
      else if (usedByStaying.has(label.id)) {
        const copy: Category = { ...label, id: crypto.randomUUID(), ownerId: userId, dirty: 1, rev: 1, createdAt: now, updatedAt: now, serverStamp: null }
        await db.categories.add(copy)
        remap.set(label.id, copy.id)
        accountByName.set(copy.name.toLowerCase(), copy.id)
      }
      else {
        await db.categories.put({ ...label, ownerId: userId, dirty: 1, rev: label.rev + 1 })
        accountByName.set(label.name.toLowerCase(), label.id)
      }
    }
    await db.tasks.bulkPut(moving.map((t): Task => ({
      ...t,
      ownerId: userId,
      categoryIds: [...new Set(t.categoryIds.map(id => remap.get(id) ?? id))],
      dirty: 1,
      rev: t.rev + 1,
    })))
    await db.meta.put({ key: importOfferedKey(userId), value: Date.now() })
    return moving.length
  })
}

/** Records that the user said no: the guest tasks stay guest tasks, and the offer isn't made again. */
export async function declineImport(userId: string, { db = getDb() }: { db?: TasksDB } = {}): Promise<void> {
  await db.meta.put({ key: importOfferedKey(userId), value: 'declined' })
}

/** Changes made while signed in that the server doesn't have yet. */
export async function unsyncedCount(userId: string, { db = getDb() }: { db?: TasksDB } = {}): Promise<number> {
  const [tasks, labels] = await Promise.all([
    db.tasks.where('[ownerId+dirty]').equals([userId, 1]).count(),
    db.categories.where('[ownerId+dirty]').equals([userId, 1]).count(),
  ])
  return tasks + labels
}

/**
 * Changes as a fingerprint that moves on every local write: the count of
 * unsynced rows and the sum of their revs (an edit to an already unsynced
 * row doesn't change the count, but it bumps a rev).
 */
export async function unsyncedFingerprint(userId: string, { db = getDb() }: { db?: TasksDB } = {}): Promise<string> {
  const [tasks, labels] = await Promise.all([
    db.tasks.where('[ownerId+dirty]').equals([userId, 1]).toArray(),
    db.categories.where('[ownerId+dirty]').equals([userId, 1]).toArray(),
  ])
  const rows = [...tasks, ...labels]
  return rows.length ? `${rows.length}:${rows.reduce((sum, row) => sum + row.rev, 0)}` : ''
}

/**
 * Sign-out's tidy-up, in one transaction: removes this user's synced rows so
 * the next person on a shared device doesn't see them, keeps the unsynced
 * ones (hidden, under the user's id) to push at the next sign-in, and deletes
 * the pull cursors in the same transaction. Without that, the next sign-in
 * would pull from the old cursor and never bring back the evicted rows
 * (review 2). Returns how many unsynced changes were kept.
 */
export async function evictSignedOutUser(userId: string, { db = getDb() }: { db?: TasksDB } = {}): Promise<number> {
  return db.transaction('rw', db.tasks, db.categories, db.meta, async () => {
    const synced = (row: { dirty: 0 | 1 }) => row.dirty === 0
    await db.tasks.where('ownerId').equals(userId).filter(synced).delete()
    await db.categories.where('ownerId').equals(userId).filter(synced).delete()
    // Deleting the generation stops any sync run already in flight, in this
    // tab or another, before it can write rows or a cursor back.
    await db.meta.bulkDelete([cursorKey(userId, 'tasks'), cursorKey(userId, 'categories'), epochKey(userId)])
    return await db.tasks.where('ownerId').equals(userId).count() + await db.categories.where('ownerId').equals(userId).count()
  })
}

/**
 * After the account is deleted: every row it owned goes from this device too
 * (it can never sync again), with its cursors and its import flag. Guest
 * tasks are untouched.
 */
export async function forgetUser(userId: string, { db = getDb() }: { db?: TasksDB } = {}): Promise<void> {
  await db.transaction('rw', db.tasks, db.categories, db.meta, async () => {
    await db.tasks.where('ownerId').equals(userId).delete()
    await db.categories.where('ownerId').equals(userId).delete()
    await db.meta.bulkDelete([cursorKey(userId, 'tasks'), cursorKey(userId, 'categories'), importOfferedKey(userId), epochKey(userId)])
  })
}
