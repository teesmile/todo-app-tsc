import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TaskList } from './taskList'

// Task order (owner, 2026-11-09): a task just added appears at the top. An
// Order switch beside the filters: "Newest" (default) is one list, newest
// added first, completed at the bottom; "Due date" is the grouped view.

async function renderList(url = '/') {
  window.history.replaceState(null, '', url)
  const user = userEvent.setup()
  render(<TaskList />)
  await waitFor(() => expect(screen.queryByText('Loading tasks')).not.toBeInTheDocument())
  return user
}

/** Titles in the order shown, read from each row's checkbox label. */
function titles(scope: HTMLElement = document.body) {
  return within(scope).queryAllByRole('checkbox').map(b => document.getElementById(b.getAttribute('aria-labelledby')!)!.textContent)
}

const order = () => screen.getByRole('group', { name: 'Order' })

describe('the Order switch', () => {
  it('defaults to Newest: native radios, one flat list, nothing in the URL', async () => {
    await renderList()
    expect(within(order()).getByRole('radio', { name: 'Newest' })).toBeChecked()
    expect(within(order()).getByRole('radio', { name: 'Due date' })).not.toBeChecked()
    // One list, headed for screen readers only; no date groups.
    expect(screen.getByRole('region', { name: /^All tasks, newest first/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /^Today/ })).not.toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('newest: a task just added is first, and completed tasks sit at the bottom', async () => {
    const user = await renderList()
    await user.type(screen.getByLabelText('New task'), 'Just added{Enter}')
    await waitFor(() => expect(titles()[0]).toBe('Just added'))

    await user.click(screen.getByRole('checkbox', { name: 'Just added' }))
    await waitFor(() => expect(titles().at(-1)).toBe('Just added'))
  })

  it('newest: with a search active, a matching task just added is first', async () => {
    const user = await renderList('/?q=weekend')
    expect(titles()).toEqual(['Plan the weekend trip'])
    await user.type(screen.getByLabelText('New task'), 'Tidy up before the weekend{Enter}')
    await waitFor(() => expect(titles()).toEqual(['Tidy up before the weekend', 'Plan the weekend trip']))
  })

  it('newest: with a filter active, a task just added is first', async () => {
    const user = await renderList('/?filter=active')
    await user.type(screen.getByLabelText('New task'), 'Fresh and active{Enter}')
    await waitFor(() => expect(titles()[0]).toBe('Fresh and active'))
  })

  it('due date: the grouped view, kept in the URL, with a task just added at the top of its group', async () => {
    const user = await renderList()
    await user.click(within(order()).getByRole('radio', { name: 'Due date' }))
    expect(window.location.search).toBe('?sort=due')
    const noDate = screen.getByRole('region', { name: /^No date/ })
    await user.type(screen.getByLabelText('New task'), 'No date, just added{Enter}')
    await waitFor(() => expect(titles(screen.getByRole('region', { name: /^No date/ }))[0]).toBe('No date, just added'))
    expect(noDate).toBeInTheDocument()
  })

  it('due date: with the Today filter, a task just added is first in Today', async () => {
    const user = await renderList('/?sort=due&filter=today')
    await user.type(screen.getByLabelText('New task'), 'Due today, just added{Enter}')
    await waitFor(() => expect(titles(screen.getByRole('region', { name: /^Today/ }))[0]).toBe('Due today, just added'))
  })

  it('keeps the chosen order across a reload, and going back to Newest clears it from the URL', async () => {
    const user = await renderList('/?sort=due&filter=active')
    expect(within(order()).getByRole('radio', { name: 'Due date' })).toBeChecked()
    expect(screen.getByRole('region', { name: /^No date/ })).toBeInTheDocument()
    await user.click(within(order()).getByRole('radio', { name: 'Newest' }))
    expect(window.location.search).toBe('?filter=active')
    expect(screen.getByRole('region', { name: /^All tasks, newest first/ })).toBeInTheDocument()
  })
})
