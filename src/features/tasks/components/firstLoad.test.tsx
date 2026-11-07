import type { TaskStats } from '../store/stats'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getDb, TasksDB } from '../store/db'
import { useStats } from '../store/hooks'
import { add, purgeGuestTombstones, remove, TOMBSTONE_RETENTION_MS } from '../store/repository'
import { StatsSummary } from './statsSummary'

// Regression tests for the portfolio capture stuck on the loading spinner.
//
// IndexedDB queues a read of a store behind any unfinished write to it. The
// list used to start a write (the tombstone purge) on every page load, so the
// first read of tasks waited for that write's disk commit; in a capture with
// a virtual-time budget the commit never lands and the list spins forever.

vi.mock('../store/hooks', async importOriginal => ({ ...(await importOriginal<typeof import('../store/hooks')>()), useStats: vi.fn() }))

/** A second connection to the same database that records every write transaction Dexie opens. */
async function recordingDb() {
  const writes: string[][] = []
  const db = new TasksDB()
  db.use({
    stack: 'dbcore',
    name: 'record-writes',
    create: down => ({
      ...down,
      transaction: (stores, mode, options) => {
        if (mode === 'readwrite')
          writes.push([...stores])
        return down.transaction(stores, mode, options)
      },
    }),
  })
  await db.open()
  return { db, writes }
}

describe('first load: nothing writes to tasks when there\'s nothing to write', () => {
  it('the purge opens no write transaction when no tombstone has expired', async () => {
    const recent = await add({ title: 'Deleted a moment ago' })
    await remove(recent.id)
    const { db, writes } = await recordingDb()

    expect(await purgeGuestTombstones({ db })).toBe(0)
    expect(writes).toEqual([])
    db.close()
  })

  it('still purges an expired tombstone, in a write', async () => {
    const old = await add({ title: 'Deleted long ago' })
    await remove(old.id)
    const { db, writes } = await recordingDb()

    expect(await purgeGuestTombstones({ db, now: Date.now() + TOMBSTONE_RETENTION_MS + 1000 })).toBe(1)
    expect(writes).toEqual([['tasks']])
    expect(await getDb().tasks.get(old.id)).toBeUndefined()
    db.close()
  })
})

describe('the Summary never states counts it doesn\'t have', () => {
  it('shows a loading state, not zeros, until the tasks are read', () => {
    vi.mocked(useStats).mockReturnValue(undefined)
    render(<StatsSummary />)
    const summary = screen.getByRole('region', { name: /^Summary/ })
    expect(summary).toHaveAttribute('aria-busy', 'true')
    expect(within(summary).queryByText('0')).not.toBeInTheDocument()
    expect(summary).toHaveTextContent('Loading')
  })

  it('shows the counts once they\'re known', () => {
    const stats: TaskStats = { total: 5, completed: 0, active: 5, overdue: 1, dueToday: 1, completedPercentage: 0, activePercentage: 100, recentlyCompleted: [] }
    vi.mocked(useStats).mockReturnValue(stats)
    render(<StatsSummary />)
    const summary = screen.getByRole('region', { name: /^Summary/ })
    expect(summary).not.toHaveAttribute('aria-busy', 'true')
    expect(within(summary).getByText('Open', { selector: 'dt' }).nextElementSibling ?? within(summary).getByText('Open', { selector: 'dt' }).previousElementSibling).toHaveTextContent('5')
  })
})
