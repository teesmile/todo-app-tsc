import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { screenSize } from '@/test/screen'
import { toLocalDateString } from '../lib/dates'
import { getDb } from '../store/db'
import { listTasks } from '../store/repository'
import { AppHeader } from './appHeader'
import { TaskList } from './taskList'

const today = toLocalDateString(new Date())

async function renderList(url = '/') {
  window.history.replaceState(null, '', url)
  const user = userEvent.setup()
  render(<TaskList />)
  await waitFor(() => expect(screen.queryByText('Loading tasks')).not.toBeInTheDocument())
  return user
}

describe('adding on a phone', () => {
  it('opens a bottom sheet from the floating button, with the title focused', async () => {
    screenSize.desktop = false
    const user = await renderList()
    await user.click(screen.getByRole('button', { name: 'Add a task' }))

    const sheet = screen.getByRole('dialog', { name: 'Add a task' })
    expect(sheet).toHaveAttribute('open')
    await waitFor(() => expect(within(sheet).getByLabelText('New task')).toHaveFocus())
  })

  it('closes on Escape and gives focus back to the floating button', async () => {
    screenSize.desktop = false
    const user = await renderList()
    const fab = screen.getByRole('button', { name: 'Add a task' })
    await user.click(fab)
    const sheet = screen.getByRole('dialog', { name: 'Add a task' })

    // A real browser fires `close` on Escape; the stand-in does the same via close().
    act(() => (sheet as HTMLDialogElement).close())
    expect(sheet).not.toHaveAttribute('open')
    await waitFor(() => expect(fab).toHaveFocus())
  })

  it('closes after adding, and announces the new task', async () => {
    screenSize.desktop = false
    const user = await renderList()
    await user.click(screen.getByRole('button', { name: 'Add a task' }))
    const sheet = screen.getByRole('dialog', { name: 'Add a task' })
    await user.type(within(sheet).getByLabelText('New task'), 'Buy stamps{Enter}')

    await waitFor(() => expect(sheet).not.toHaveAttribute('open'))
    expect(screen.getByRole('status')).toHaveTextContent('Added "Buy stamps"')
    expect((await listTasks()).some(t => t.title === 'Buy stamps')).toBe(true)
  })

  it('opens the sheet on "n" when the inline form is hidden', async () => {
    screenSize.desktop = false
    const user = await renderList()
    screen.getAllByRole('checkbox')[0].focus()
    await user.keyboard('n')
    expect(screen.getByRole('dialog', { name: 'Add a task' })).toHaveAttribute('open')
  })
})

describe('the Today filter', () => {
  it('gives a task added while it is on today as its due date, and shows that on the chip', async () => {
    const user = await renderList('/?filter=today')
    const form = screen.getByLabelText('New task').closest('form')!
    expect(within(form).getByRole('button', { name: /due date for the new task/i })).toHaveTextContent('Due today')

    await user.type(screen.getByLabelText('New task'), 'Pick up the parcel{Enter}')
    await waitFor(async () => expect((await listTasks()).find(t => t.title === 'Pick up the parcel')?.dueDate).toBe(today))
    // And it stays visible in the view it was added in.
    expect(await screen.findByRole('button', { name: 'Edit "Pick up the parcel"' })).toBeInTheDocument()
  })

  it('lets the default be changed before adding', async () => {
    const user = await renderList('/?filter=today')
    await user.type(screen.getByLabelText('New task'), 'Someday task')
    await user.click(screen.getByRole('button', { name: /due date for the new task/i }))
    await user.click(screen.getByRole('button', { name: 'No due date' }))
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    await waitFor(async () => expect((await listTasks()).find(t => t.title === 'Someday task')?.dueDate).toBeNull())
  })
})

describe('the header', () => {
  it('greets with the time of day and today\'s date, and asks for a name once', async () => {
    const user = userEvent.setup()
    render(<AppHeader />)
    const heading = await screen.findByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)$/ })
    expect(heading.nextElementSibling?.textContent).toMatch(/^[A-Z][a-z]+day \d{1,2} [A-Z][a-z]+$/)

    await user.type(await screen.findByLabelText(/What should we call you/), 'Toni')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Toni$/))
    expect(screen.queryByLabelText(/What should we call you/)).not.toBeInTheDocument()
    expect((await getDb().meta.get('displayName'))?.value).toBe('Toni')
  })

  it('remembers a skip, so the prompt never comes back', async () => {
    const user = userEvent.setup()
    const first = render(<AppHeader />)
    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(screen.queryByLabelText(/What should we call you/)).not.toBeInTheDocument())
    first.unmount()

    render(<AppHeader />)
    await screen.findByRole('heading', { level: 1, name: /^Good / })
    // Give the live query time to answer before checking it stays away.
    await act(async () => new Promise(r => setTimeout(r, 50)))
    expect(screen.queryByLabelText(/What should we call you/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toContain(',')
  })

  it('keeps a name to 40 characters and ignores a blank one', async () => {
    render(<AppHeader />)
    const field = await screen.findByLabelText(/What should we call you/)
    expect(field).toHaveAttribute('maxLength', '40')
    fireEvent.change(field, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
