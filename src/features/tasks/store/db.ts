import type { EntityTable } from 'dexie'
import type { MetaEntry, Task } from './types'
import Dexie from 'dexie'
import { sampleTasks } from '../data/sample-tasks'
import { addDays, toLocalDateString } from '../lib/dates'
import { GUEST } from './types'

export const TASKS_DB_NAME = 'tasks'
export const INSTALL_ID_KEY = 'installId'

export class TasksDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor(name = TASKS_DB_NAME) {
    super(name)
    // The sync fields (ownerId, dirty, rev, deletedAt) are in version 1 so
    // that Phase 9 never has to migrate data users already have.
    this.version(1).stores({
      tasks: 'id, ownerId, [ownerId+dirty], isSample',
      meta: 'key',
    })

    // Dexie fires `populate` exactly once, when the database is first
    // created, inside the creation transaction. A crash part-way through
    // rolls back the whole creation, so it can't leave half the samples
    // behind and then seed duplicates on the next visit.
    this.on('populate', (tx) => {
      const now = Date.now()
      const today = new Date(now)
      tx.table<Task, string>('tasks').bulkAdd(sampleTasks.map((sample, i) => ({
        id: crypto.randomUUID(),
        ownerId: GUEST,
        title: sample.title,
        completed: false,
        dueDate: sample.dueInDays === null ? null : toLocalDateString(addDays(today, sample.dueInDays)),
        isSample: 1,
        dirty: 0,
        rev: 0,
        // Spaced 1 ms apart so newest-first order matches the list order.
        createdAt: now - i,
        updatedAt: now - i,
        completedAt: null,
        deletedAt: null,
      })))
      // Identifies this browser's database. Legacy-import ids are derived
      // from it, so they're stable here and different on every other device.
      tx.table<MetaEntry, string>('meta').add({ key: INSTALL_ID_KEY, value: crypto.randomUUID() })
    })
  }
}

let instance: TasksDB | null = null

/**
 * The app's database, created on first use. Never constructed at module load:
 * the static export prerenders `/` in Node, where IndexedDB doesn't exist, and
 * client components still run during that prerender.
 */
export function getDb(): TasksDB {
  instance ??= new TasksDB()
  return instance
}

/** Closes and forgets the shared instance, so the next `getDb()` reopens. Tests only. */
export function resetDbForTests(): void {
  instance?.close()
  instance = null
}

export async function getInstallId(db: TasksDB = getDb()): Promise<string> {
  const entry = await db.meta.get(INSTALL_ID_KEY)
  if (typeof entry?.value !== 'string')
    throw new Error('installId missing: the database was not populated')
  return entry.value
}
