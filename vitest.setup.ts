import { cleanup } from '@testing-library/react'
import Dexie from 'dexie'
import { afterEach, vi } from 'vitest'
import { resetDbForTests, TASKS_DB_NAME } from '@/features/tasks/store/db'
import { LEGACY_DB_NAME } from '@/features/tasks/store/legacyImport'
import { screenSize } from '@/test/screen'
import '@testing-library/jest-dom/vitest'

// Outside a Next app router, useSearchParams returns null. Read the real
// window.location instead, so a test can set ?filter=overdue and "reload".
// The mock's key must match next/navigation's export.
// eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }))

// jsdom has no <dialog> modal API and no matchMedia. These stand-ins do what
// our code relies on: showModal/close toggle `open` and fire `close`, and
// matchMedia reports a desktop-width screen unless a test says otherwise.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
    // The dialog focusing steps: an [autofocus] descendant, else the first
    // focusable control. Browsers do this, and it moves focus away from
    // anything focused before the dialog opened.
    const target = this.querySelector<HTMLElement>('[autofocus]')
      ?? this.querySelector<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')
    target?.focus()
  }
  // A browser treats an unhandled Escape as a close request for the top
  // modal dialog. Anything that calls preventDefault (or stops the event)
  // keeps the dialog open, as in Chrome and Firefox.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented)
      return
    const open = [...document.querySelectorAll('dialog[open]')].at(-1) as HTMLDialogElement | undefined
    open?.close()
  })
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open'))
      return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
window.matchMedia = (query: string) => ({
  matches: query.includes('min-width') ? screenSize.desktop : !screenSize.desktop,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})

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
  screenSize.desktop = true
  // Every test starts from an empty IndexedDB: close the shared connection,
  // then delete both databases.
  resetDbForTests()
  await Dexie.delete(TASKS_DB_NAME)
  await deleteRaw(LEGACY_DB_NAME)
})
