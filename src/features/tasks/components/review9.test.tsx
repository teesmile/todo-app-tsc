import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TasksDB } from '../store/db'
import { createCategory, listCategories, updateCategory } from '../store/repository'
import { TaskList } from './taskList'

// Regression test for the label finding of review 9.

async function otherTab(change: (db: TasksDB) => Promise<unknown>) {
  const db = new TasksDB()
  await db.open()
  await change(db)
  db.close()
}

describe('2: a rename conflict survives a colour change', () => {
  it('still needs Enter after recolouring, so leaving the field keeps the other tab\'s name', async () => {
    const work = await createCategory({ name: 'Work', color: 'blue' })
    const user = userEvent.setup()
    render(<TaskList />)
    await user.click(await screen.findByRole('button', { name: 'Manage labels' }))
    const manager = screen.getByRole('dialog', { name: 'Labels' })
    const field = await within(manager).findByLabelText('Name of label "Work"')
    await user.clear(field)
    await user.type(field, 'Job')
    await otherTab(db => updateCategory(work.id, { name: 'Office' }, { db }))
    await user.keyboard('{Enter}')
    expect(await within(manager).findByRole('alert')).toHaveTextContent('Renamed in another tab to "Office"')

    // Recolour, then go back to the name field and leave it.
    await user.selectOptions(within(manager).getByLabelText(/^Colour of label/), 'green')
    await waitFor(async () => expect((await listCategories())[0].color).toBe('green'))
    expect(within(manager).getByRole('alert')).toHaveTextContent('Renamed in another tab to "Office"')
    await user.click(within(manager).getByLabelText(/^Name of label/))
    await user.tab()
    await new Promise(r => setTimeout(r, 100))
    expect((await listCategories())[0].name).toBe('Office')

    // Enter is still the explicit way to keep yours.
    await user.click(within(manager).getByLabelText(/^Name of label/))
    await user.keyboard('{Enter}')
    await waitFor(async () => expect((await listCategories())[0].name).toBe('Job'))
  })
})
