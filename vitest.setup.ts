import { cleanup } from '@testing-library/react'
import Dexie from 'dexie'
import { afterEach } from 'vitest'
import { resetDbForTests, TASKS_DB_NAME } from '@/features/tasks/store/db'
import { LEGACY_DB_NAME } from '@/features/tasks/store/legacyImport'
import '@testing-library/jest-dom/vitest'

function deleteRaw(name: string) {
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}

afterEach(async () => {
  // Testing Library only auto-cleans when Vitest globals are on; they're off here.
  cleanup()
  // Every test starts from an empty IndexedDB: close the shared connection,
  // then delete both databases.
  resetDbForTests()
  await Dexie.delete(TASKS_DB_NAME)
  await deleteRaw(LEGACY_DB_NAME)
})
