import type { LegacyTodo } from './legacyImport'
import { validate as isUuid, version as uuidVersion } from 'uuid'
import { describe, expect, it, vi } from 'vitest'
import { getDb, getInstallId, TasksDB } from './db'
import { LEGACY_DB_NAME, legacyTaskId, runLegacyImport } from './legacyImport'
import { listTasks, MAX_TITLE_LENGTH, TitleError, update } from './repository'

const DAY = 24 * 60 * 60 * 1000
const t0 = new Date('2026-10-01T09:00:00Z')

// Rows shaped exactly as the pre-v1 wrapper (src/lib/indexedDB.ts) stored them.
const rows: LegacyTodo[] = [
  { id: 1794051495204, todo: 'Mine, created locally', completed: false, isLocal: true, createdAt: t0, updatedAt: t0 },
  { id: 7, todo: 'Dummyjson row I completed', completed: true, isLocal: false, createdAt: t0, updatedAt: new Date(t0.getTime() + DAY) },
  { id: 8, todo: 'Dummyjson row never touched', completed: false, isLocal: false, createdAt: t0, updatedAt: t0 },
  { id: 1794051495999, todo: 'Mine, but I deleted it', completed: false, isLocal: true, createdAt: t0, updatedAt: t0, deletedAt: t0 },
]

/** Creates TodoAppDB at version 1 and leaves the connection open, like an old tab. */
function openOldTab(seed: LegacyTodo[] = rows): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(LEGACY_DB_NAME, 1)
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore('todos', { keyPath: 'id' })
      for (const row of seed)
        store.put(row)
    }
    // Deliberately no onversionchange handler: the old code didn't have one.
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function seedLegacy(seed: LegacyTodo[] = rows) {
  (await openOldTab(seed)).close()
}

function oldTabWrite(db: IDBDatabase, row: LegacyTodo) {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('todos', 'readwrite')
    tx.objectStore('todos').put(row)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function legacyDatabaseExists() {
  return (await indexedDB.databases()).some(d => d.name === LEGACY_DB_NAME)
}

/** Clears the importedAt marker, as if an earlier run crashed right after inserting. */
function forgetImportedAt() {
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(LEGACY_DB_NAME, 2)
    req.onsuccess = () => {
      const tx = req.result.transaction('cutover', 'readwrite')
      tx.objectStore('cutover').delete('state')
      tx.oncomplete = () => {
        req.result.close()
        resolve()
      }
    }
    req.onerror = () => reject(req.error)
  })
}

const importedTitles = async () => (await listTasks()).filter(t => t.isSample === 0).map(t => t.title).sort()

describe('legacy import', () => {
  it('does nothing, and creates no TodoAppDB, when there was no old version', async () => {
    expect(await runLegacyImport()).toEqual({ status: 'no-legacy-db' })
    expect(await legacyDatabaseExists()).toBe(false)
  })

  it('imports what the user created or changed, and skips tombstones and untouched dummyjson rows', async () => {
    await seedLegacy()
    expect(await runLegacyImport()).toEqual({ status: 'imported', imported: 2, skipped: 0 })
    expect(await importedTitles()).toEqual(['Dummyjson row I completed', 'Mine, created locally'])
  })

  it('gives every imported task a valid UUID v5, stable per install and different across installs', async () => {
    await seedLegacy()
    await runLegacyImport()
    const installId = await getInstallId()

    for (const task of (await listTasks()).filter(t => t.isSample === 0)) {
      expect(isUuid(task.id)).toBe(true)
      expect(uuidVersion(task.id)).toBe(5)
    }
    expect(legacyTaskId(7, installId)).toBe(legacyTaskId(7, installId))
    expect(legacyTaskId(7, installId)).not.toBe(legacyTaskId(7, crypto.randomUUID()))
  })

  it('runs once: a second run reports already-imported and changes nothing', async () => {
    await seedLegacy()
    await runLegacyImport()
    expect(await runLegacyImport()).toEqual({ status: 'already-imported' })
    expect(await importedTitles()).toHaveLength(2)
  })

  it('keeps an edit made after an interrupted import when the import re-runs', async () => {
    await seedLegacy()
    await runLegacyImport()
    const [mine] = (await listTasks()).filter(t => t.title === 'Mine, created locally')
    await update(mine.id, { title: 'Mine, edited after import' })
    await forgetImportedAt()

    expect(await runLegacyImport()).toEqual({ status: 'imported', imported: 0, skipped: 2 })
    expect(await importedTitles()).toEqual(['Dummyjson row I completed', 'Mine, edited after import'])
  })

  it('creates no duplicates when two tabs import at the same time', async () => {
    await seedLegacy()
    const otherTab = new TasksDB()
    await Promise.allSettled([runLegacyImport(), runLegacyImport({ db: otherTab })])
    otherTab.close()

    expect(await importedTitles()).toEqual(['Dummyjson row I completed', 'Mine, created locally'])
  })

  it('keeps the source, unmarked, when the import fails part-way, and a retry then succeeds', async () => {
    await seedLegacy()
    const spy = vi.spyOn(getDb().tasks, 'bulkAdd').mockRejectedValueOnce(new Error('disk full'))

    await expect(runLegacyImport()).rejects.toThrow('disk full')
    spy.mockRestore()
    expect(await legacyDatabaseExists()).toBe(true)
    expect(await importedTitles()).toEqual([])

    expect(await runLegacyImport()).toMatchObject({ status: 'imported', imported: 2 })
  })

  it('keeps a long description whole, and lets it be shortened but not grown', async () => {
    const long = `Moving checklist: ${'pack, label and photograph each box; '.repeat(18)}`.trim()
    expect(long.length).toBeGreaterThan(MAX_TITLE_LENGTH)
    await seedLegacy([{ id: 1794051495300, todo: long, completed: false, isLocal: true, createdAt: t0, updatedAt: t0 }])

    await runLegacyImport()
    const [task] = (await listTasks()).filter(t => t.isSample === 0)
    expect(task.title).toBe(long)

    await expect(update(task.id, { title: `${long} and more` })).rejects.toBeInstanceOf(TitleError)
    expect((await update(task.id, { title: long.slice(0, 600) })).title).toBe(long.slice(0, 600).trim())
  })

  it('waits for an old tab, imports what it wrote meanwhile, then locks old code out', async () => {
    const oldTab = await openOldTab()
    const onBlocked = vi.fn()
    const result = runLegacyImport({ onBlocked })

    await vi.waitFor(() => expect(onBlocked).toHaveBeenCalled())
    // The old tab is still working while the new one waits.
    await oldTabWrite(oldTab, { id: 1794051500000, todo: 'Written by the old tab during the cutover', completed: false, isLocal: true, createdAt: t0, updatedAt: t0 })
    oldTab.close()

    expect(await result).toEqual({ status: 'imported', imported: 3, skipped: 0 })
    expect(await importedTitles()).toContain('Written by the old tab during the cutover')

    // Old code asks for version 1; the database is now at 2.
    const reopen = indexedDB.open(LEGACY_DB_NAME, 1)
    const error = await new Promise<DOMException | null>((resolve) => {
      reopen.onsuccess = () => {
        reopen.result.close()
        resolve(null)
      }
      reopen.onerror = () => resolve(reopen.error)
    })
    expect(error?.name).toBe('VersionError')
  })
})
