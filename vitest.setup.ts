import { cleanup } from '@testing-library/react'
import Dexie from 'dexie'
import { afterEach, vi } from 'vitest'
import { resetDbForTests, TASKS_DB_NAME } from '@/features/tasks/store/db'
import { LEGACY_DB_NAME } from '@/features/tasks/store/legacyImport'
import '@testing-library/jest-dom/vitest'

// Outside a Next app router, useSearchParams returns null. Read the real
// window.location instead, so a test can set ?filter=overdue and "reload".
// The mock's key must match next/navigation's export.
// eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }))

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
  window.history.replaceState(null, '', '/')
  // Every test starts from an empty IndexedDB: close the shared connection,
  // then delete both databases.
  resetDbForTests()
  await Dexie.delete(TASKS_DB_NAME)
  await deleteRaw(LEGACY_DB_NAME)
})
