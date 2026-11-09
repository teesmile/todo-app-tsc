import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getDb } from '../store/db'
import { add, createCategory, listCategories, listTasks, update } from '../store/repository'
import { TaskList } from './taskList'

async function renderList(url = '/?sort=due') {
  window.history.replaceState(null, '', url)
  const user = userEvent.setup()
  render(<TaskList />)
  await waitFor(() => expect(screen.queryByText('Loading tasks')).not.toBeInTheDocument())
  return user
}
const stored = async (title: string) => (await listTasks()).find(t => t.title === title)
function titlesIn(group: string) {
  return within(screen.getByRole('region', { name: new RegExp(`^${group}`) }))
    .getAllByRole('checkbox')
    .map(box => document.getElementById(box.getAttribute('aria-labelledby')!)!.textContent)
}

describe('vital', () => {
  it('toggles Vital from the row, and the newest task stays on top of its group (owner, 2026-11-09)', async () => {
    await add({ title: 'Ordinary later', dueDate: null })
    await add({ title: 'Newest', dueDate: null })
    const user = await renderList()
    // Only these two: the samples are seeded when the first add opens the database.
    const order = () => titlesIn('No date').filter(t => t === 'Newest' || t === 'Ordinary later')
    expect(order()).toEqual(['Newest', 'Ordinary later'])

    const older = await stored('Ordinary later')
    await user.click(screen.getByRole('button', { name: 'Vital: "Ordinary later"' }))
    await waitFor(async () => expect((await stored('Ordinary later'))?.vital).toBe(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Vital: "Ordinary later"' })).toHaveAttribute('aria-pressed', 'true'))
    expect(order()).toEqual(['Newest', 'Ordinary later'])
    expect(older?.vital).toBe(0)
  })

  it('filters to Vital tasks, and a task added under that filter is vital', async () => {
    const user = await renderList('/?filter=vital')
    expect(screen.getAllByRole('checkbox').map(b => document.getElementById(b.getAttribute('aria-labelledby')!)!.textContent)).toEqual(['Renew your passport'])

    await user.type(screen.getByLabelText('New task'), 'Urgent thing{Enter}')
    await waitFor(async () => expect((await stored('Urgent thing'))?.vital).toBe(1))
    expect(await screen.findByRole('button', { name: 'Edit "Urgent thing"' })).toBeInTheDocument()
  })
})

describe('labels', () => {
  it('creates a label in the manager, rejects a duplicate, and puts it on a task', async () => {
    const user = await renderList()
    await user.click(screen.getByRole('button', { name: 'Manage labels' }))
    const manager = screen.getByRole('dialog', { name: 'Labels' })
    await user.type(within(manager).getByLabelText('New label'), 'Work')
    await user.selectOptions(within(manager).getByLabelText('Colour of the new label'), 'violet')
    await user.click(within(manager).getByRole('button', { name: 'Add label' }))
    await waitFor(async () => expect((await listCategories()).map(c => [c.name, c.color])).toEqual([['Work', 'violet']]))

    await user.type(within(manager).getByLabelText('New label'), 'work{Enter}')
    expect(await within(manager).findByRole('alert')).toHaveTextContent('There\'s already a label called "Work".')
    await user.click(within(manager).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Labels for "Water the plants": none' }))
    await user.click(screen.getByRole('checkbox', { name: 'Work' }))
    const work = (await listCategories())[0]
    await waitFor(async () => expect((await stored('Water the plants'))?.categoryIds).toEqual([work.id]))
    expect(await screen.findByRole('button', { name: 'Labels for "Water the plants": Work' })).toBeInTheDocument()
  })

  it('removes a label from a task by unticking it', async () => {
    const home = await createCategory({ name: 'Home', color: 'green' })
    const task = await add({ title: 'Fix the tap', categoryIds: [home.id] })
    const user = await renderList()
    await user.click(await screen.findByRole('button', { name: 'Labels for "Fix the tap": Home' }))
    await user.click(screen.getByRole('checkbox', { name: 'Home' }))
    await waitFor(async () => expect((await getDb().tasks.get(task.id))?.categoryIds).toEqual([]))
  })

  it('renames and recolours a label in the manager', async () => {
    await createCategory({ name: 'Errands', color: 'blue' })
    const user = await renderList()
    await user.click(screen.getByRole('button', { name: 'Manage labels' }))
    const manager = screen.getByRole('dialog', { name: 'Labels' })
    const nameField = await within(manager).findByLabelText('Name of label "Errands"')
    await user.clear(nameField)
    await user.type(nameField, 'Shopping{Enter}')
    await waitFor(async () => expect((await listCategories())[0].name).toBe('Shopping'))
    await user.selectOptions(await within(manager).findByLabelText('Colour of label "Shopping"'), 'pink')
    await waitFor(async () => expect((await listCategories())[0].color).toBe('pink'))
  })

  it('asks before deleting a label, says how many tasks use it, and takes it off them', async () => {
    const work = await createCategory({ name: 'Work', color: 'blue' })
    await add({ title: 'Report', categoryIds: [work.id] })
    await add({ title: 'Slides', categoryIds: [work.id] })
    const user = await renderList()
    await user.click(screen.getByRole('button', { name: 'Manage labels' }))
    const manager = screen.getByRole('dialog', { name: 'Labels' })
    await user.click(await within(manager).findByRole('button', { name: 'Delete "Work"' }))

    const confirm = within(manager).getByRole('group', { name: 'Confirm deleting "Work"' })
    expect(confirm).toHaveTextContent('It\'s on 2 tasks; they keep everything else.')
    await user.click(within(confirm).getByRole('button', { name: 'Keep it' }))
    expect(await listCategories()).toHaveLength(1)

    await user.click(within(manager).getByRole('button', { name: 'Delete "Work"' }))
    await user.click(within(manager).getByRole('button', { name: 'Delete label' }))
    await waitFor(async () => expect(await listCategories()).toHaveLength(0))
    expect((await stored('Report'))?.categoryIds).toEqual([])
    expect((await stored('Slides'))?.title).toBe('Slides')
  })

  it('filters by label from the URL, and a task added under it gets that label', async () => {
    const work = await createCategory({ name: 'Work', color: 'blue' })
    await add({ title: 'Report', categoryIds: [work.id] })
    const user = await renderList(`/?label=${work.id}`)
    expect(screen.getByLabelText('Label')).toHaveValue(work.id)
    expect(screen.getAllByRole('checkbox').map(b => document.getElementById(b.getAttribute('aria-labelledby')!)!.textContent)).toEqual(['Report'])

    await user.type(screen.getByLabelText('New task'), 'Invoice{Enter}')
    await waitFor(async () => expect((await stored('Invoice'))?.categoryIds).toEqual([work.id]))
  })

  it('treats a label filter for a deleted label as all labels', async () => {
    const gone = await createCategory({ name: 'Gone', color: 'red' })
    const keep = await createCategory({ name: 'Kept', color: 'teal' })
    await add({ title: 'Labelled', categoryIds: [keep.id] })
    await update((await stored('Labelled'))!.id, { categoryIds: [keep.id, gone.id] })
    const { removeCategory } = await import('../store/repository')
    await removeCategory(gone.id)
    await renderList(`/?label=${gone.id}`)
    expect(screen.getByLabelText('Label')).toHaveValue('')
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(1)
  })
})
