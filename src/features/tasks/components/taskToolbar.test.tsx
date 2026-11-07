import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { add } from '../store/repository'
import { TaskList } from './taskList'

async function renderList(url = '/') {
  window.history.replaceState(null, '', url)
  const user = userEvent.setup()
  render(<TaskList />)
  await screen.findByRole('region', { name: /^No date/ }).catch(() => {})
  await waitFor(() => expect(screen.queryByText('Loading tasks')).not.toBeInTheDocument())
  return user
}

const shownTitles = () => screen.queryAllByRole('checkbox').map(box => document.getElementById(box.getAttribute('aria-labelledby')!)!.textContent)

describe('shortcuts', () => {
  it('types an "n" into the search box instead of jumping to the add field', async () => {
    const user = await renderList()
    const search = screen.getByRole('searchbox', { name: 'Search tasks' })
    await user.click(search)
    await user.keyboard('plan')

    expect(search).toHaveValue('plan')
    expect(search).toHaveFocus()
  })

  it('focuses search on "/" and the add field on "n", from a task\'s checkbox', async () => {
    const user = await renderList()
    screen.getAllByRole('checkbox')[0].focus()

    await user.keyboard('/')
    expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toHaveFocus()
    expect(screen.getByRole('searchbox', { name: 'Search tasks' })).toHaveValue('')

    screen.getAllByRole('checkbox')[0].focus()
    await user.keyboard('n')
    expect(screen.getByLabelText('New task')).toHaveFocus()
    expect(screen.getByLabelText('New task')).toHaveValue('')
  })

  it('ignores the shortcuts while Ctrl, Meta or Alt is held', async () => {
    const user = await renderList()
    const checkbox = screen.getAllByRole('checkbox')[0]
    checkbox.focus()
    await user.keyboard('{Control>}n{/Control}{Alt>}/{/Alt}{Meta>}n{/Meta}')
    expect(checkbox).toHaveFocus()
  })

  it('leaves the search on Escape and keeps what was typed', async () => {
    const user = await renderList()
    const search = screen.getByRole('searchbox', { name: 'Search tasks' })
    await user.click(search)
    await user.keyboard('plants{Escape}')

    expect(search).not.toHaveFocus()
    expect(search).toHaveValue('plants')
  })
})

describe('filters and search', () => {
  it('restores the filter from the URL on reload', async () => {
    await renderList('/?filter=overdue')
    expect(screen.getByRole('radio', { name: 'Overdue' })).toBeChecked()
    expect(shownTitles()).toEqual(['Renew your passport'])
  })

  it('ignores an unknown filter in the URL', async () => {
    await renderList('/?filter=everything')
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
  })

  it('is a radio group in a labelled fieldset', async () => {
    await renderList()
    const group = screen.getByRole('group', { name: 'Show' })
    expect(within(group).getAllByRole('radio').map(r => r.getAttribute('value'))).toEqual(['all', 'active', 'done', 'today', 'overdue'])
  })

  it('writes a filter change to the URL straight away, without adding history', async () => {
    const user = await renderList()
    const before = window.history.length
    await user.click(screen.getByRole('radio', { name: 'Done' }))

    expect(new URLSearchParams(window.location.search).get('filter')).toBe('done')
    expect(window.history.length).toBe(before)
  })

  it('filters on every keystroke, and writes the search to the URL after a pause', async () => {
    await add({ title: 'Crème brûlée for dinner' })
    const user = await renderList()
    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'creme')

    // The list has already narrowed, accent-insensitively...
    expect(shownTitles()).toEqual(['Crème brûlée for dinner'])
    // ...while the URL catches up once typing stops.
    expect(new URLSearchParams(window.location.search).get('q')).toBeNull()
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('q')).toBe('creme'))
  })

  it('says when nothing matches, rather than showing an empty list', async () => {
    const user = await renderList()
    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'zebra')
    expect(screen.getByText('No tasks match "zebra".')).toBeInTheDocument()
  })

  it('announces how many tasks are shown', async () => {
    const user = await renderList()
    await user.click(screen.getByRole('radio', { name: 'Overdue' }))
    expect(screen.getByText('1 task shown')).toHaveAttribute('aria-live', 'polite')
  })
})
