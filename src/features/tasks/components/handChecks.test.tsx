import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { screenSize } from '@/test/screen'
import { add, listTasks } from '../store/repository'
import { TaskList } from './taskList'

// The three checks named after Phase 5, whose Codex review was outstanding.

async function renderList(url = '/') {
  window.history.replaceState(null, '', url)
  const user = userEvent.setup()
  render(<TaskList />)
  await waitFor(() => expect(screen.queryByText('Loading tasks')).not.toBeInTheDocument())
  return user
}
const params = () => new URLSearchParams(window.location.search)

describe('(a) a filter or search hiding a task just added or edited', () => {
  it('says when a new task is hidden by the search, and Show all reveals it', async () => {
    const user = await renderList('/?q=passport')
    await user.type(screen.getByLabelText('New task'), 'Buy bread{Enter}')

    const status = screen.getByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('Added "Buy bread", but the current search or filter hides it.'))
    await user.click(within(status).getByRole('button', { name: 'Show all' }))
    expect(await screen.findByRole('button', { name: 'Edit "Buy bread"' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toHaveValue('')
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
  })

  it('says when a new task is hidden by the Overdue filter', async () => {
    const user = await renderList('/?filter=overdue')
    await user.type(screen.getByLabelText('New task'), 'Call mum{Enter}')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Added "Call mum", but the current search or filter hides it.'))
  })

  it('says nothing extra when the new task is visible', async () => {
    const user = await renderList()
    await user.type(screen.getByLabelText('New task'), 'Visible task{Enter}')
    expect(await screen.findByRole('button', { name: 'Edit "Visible task"' })).toBeInTheDocument()
    expect(screen.getByRole('status')).not.toHaveTextContent('hides it')
  })

  it('says when an edit moves a task out of the current search', async () => {
    await add({ title: 'Milk and eggs' })
    const user = await renderList('/?q=milk')
    await user.click(await screen.findByRole('button', { name: 'Edit "Milk and eggs"' }))
    const field = screen.getByRole('textbox', { name: 'Edit "Milk and eggs"' })
    await user.clear(field)
    await user.type(field, 'Bread{Enter}')

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved "Bread", but the current search or filter hides it.'))
    expect((await listTasks()).some(t => t.title === 'Bread')).toBe(true)
  })
})

describe('(b) Escape and shortcuts inside the date picker and the inline editor', () => {
  it('types "n" and "/" into the inline editor without jumping focus', async () => {
    const user = await renderList()
    await user.click(screen.getByRole('button', { name: 'Edit "Water the plants"' }))
    const field = screen.getByRole('textbox', { name: 'Edit "Water the plants"' })
    await user.type(field, ' n/')
    expect(field).toHaveValue('Water the plants n/')
    expect(field).toHaveFocus()
  })

  it('keeps shortcuts out of the date picker', async () => {
    const user = await renderList()
    await user.click(screen.getByRole('button', { name: /^Due date for "Water the plants"/ }))
    await user.click(screen.getByRole('button', { name: 'Pick a date…' }))
    const date = screen.getByLabelText('Pick a date')
    await user.keyboard('n/')
    expect(date).toHaveFocus()
  })

  it('closes only the due chooser on Escape inside the bottom sheet, not the sheet', async () => {
    screenSize.desktop = false
    const user = await renderList()
    await user.click(screen.getByRole('button', { name: 'Add a task' }))
    const sheet = screen.getByRole('dialog', { name: 'Add a task' })
    await user.click(within(sheet).getByRole('button', { name: /^Due date for the new task/ }))
    expect(within(sheet).getByRole('button', { name: 'Tomorrow' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(within(sheet).queryByRole('button', { name: 'Tomorrow' })).not.toBeInTheDocument()
    expect(sheet).toHaveAttribute('open')

    await user.keyboard('{Escape}')
    expect(sheet).not.toHaveAttribute('open')
  })

  it('cancels the inline edit on Escape and leaves the search untouched', async () => {
    const user = await renderList('/?q=water')
    await user.click(screen.getByRole('button', { name: 'Edit "Water the plants"' }))
    await user.type(screen.getByRole('textbox', { name: 'Edit "Water the plants"' }), ' x{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Edit "Water the plants"' })).not.toBeInTheDocument()
    expect((await listTasks()).find(t => t.title.startsWith('Water'))?.title).toBe('Water the plants')
    expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toHaveValue('water')
  })
})

describe('(c) the delayed URL write never restores a stale filter or search', () => {
  it('writes the latest search and filter when the filter changes during the debounce', async () => {
    const user = await renderList()
    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'plan')
    await user.click(screen.getByRole('radio', { name: 'Active' }))
    expect(params().get('filter')).toBe('active')

    await new Promise(r => setTimeout(r, 400))
    expect(params().get('filter')).toBe('active')
    expect(params().get('q')).toBe('plan')
  })

  it('removes a cleared search from the URL instead of writing back the old one', async () => {
    const user = await renderList('/?q=passport&filter=overdue')
    await user.clear(screen.getByRole('searchbox', { name: 'Search tasks' }))
    await user.click(screen.getByRole('radio', { name: 'All' }))

    await new Promise(r => setTimeout(r, 400))
    expect(params().get('q')).toBeNull()
    expect(params().get('filter')).toBeNull()
  })
})
