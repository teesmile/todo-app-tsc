import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getDb } from '../store/db'
import { add, createCategory, listCategories, mergeCategory } from '../store/repository'
import { TaskList } from './taskList'

// Two offline devices that both create "Work" sync into a duplicate pair; the
// server allows it so neither push fails. The label manager offers a merge.

async function duplicatePair() {
  const older = await createCategory({ name: 'Work', color: 'blue' })
  // Arrived by sync from another device: same name, created later.
  const newer = { ...older, id: crypto.randomUUID(), color: 'teal' as const, createdAt: older.createdAt + 1000 }
  await getDb().categories.add(newer)
  return { older, newer }
}

describe('merging duplicate labels', () => {
  it('moves every task to the older label, once, and deletes the duplicate', async () => {
    const { older, newer } = await duplicatePair()
    const both = await add({ title: 'Both', categoryIds: [older.id, newer.id] })
    const onlyNewer = await add({ title: 'Only the newer', categoryIds: [newer.id] })

    expect(await mergeCategory(newer.id, older.id)).toBe(2)
    expect((await getDb().tasks.get(both.id))?.categoryIds).toEqual([older.id])
    expect((await getDb().tasks.get(onlyNewer.id))?.categoryIds).toEqual([older.id])
    expect((await getDb().categories.get(newer.id))?.deletedAt).not.toBeNull()
    expect((await listCategories()).map(c => c.id)).toEqual([older.id])
  })

  it('offers the merge on the duplicate only, in the label manager', async () => {
    const { older } = await duplicatePair()
    await add({ title: 'Labelled', categoryIds: [older.id] })
    const user = userEvent.setup()
    render(<TaskList />)
    await user.click(await screen.findByRole('button', { name: 'Manage labels' }))
    const manager = screen.getByRole('dialog', { name: 'Labels' })
    const merges = await within(manager).findAllByRole('button', { name: 'Merge into the other "Work"' })
    expect(merges).toHaveLength(1)

    await user.click(merges[0])
    await waitFor(async () => expect((await listCategories()).map(c => c.id)).toEqual([older.id]))
    await waitFor(() => expect(within(manager).queryByRole('button', { name: /^Merge/ })).not.toBeInTheDocument())
  })
})
