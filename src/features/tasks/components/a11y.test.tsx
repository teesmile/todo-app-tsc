import type { AxeResults } from 'axe-core'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'
import { runLegacyImport } from '@/features/tasks/store/legacyImport'
import { screenSize } from '@/test/screen'
import Home from '../../../app/page'
import { getDb } from '../store/db'
import { add, createCategory, listTasks } from '../store/repository'

vi.mock('@/features/tasks/store/legacyImport', () => ({ runLegacyImport: vi.fn() }))
vi.mocked(runLegacyImport).mockResolvedValue({ status: 'no-legacy-db' })

// jsdom can't compute colours, so contrast is checked in the real browser
// (see the Phase 8 browser check). Everything else axe knows runs here.
async function violations(context: Element = document.body) {
  const result: AxeResults = await axe.run(context, { rules: { 'color-contrast': { enabled: false } } })
  return result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
}

async function renderHome() {
  const user = userEvent.setup()
  render(<Home />)
  await screen.findByRole('region', { name: /^No date/ })
  await screen.findByRole('heading', { level: 1, name: /^Good / })
  return user
}

describe('axe on the main views', () => {
  it('finds nothing on the home page', async () => {
    await createCategory({ name: 'Work', color: 'blue' })
    await renderHome()
    expect(await violations()).toEqual([])
  })

  it('finds nothing with the due chooser and the label chooser open', async () => {
    const user = await renderHome()
    await user.click(screen.getByRole('button', { name: /due date for "Water the plants"/i }))
    expect(await violations()).toEqual([])
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /^Labels for "Water the plants"/ }))
    expect(await violations()).toEqual([])
  })

  it('finds nothing in the labels manager or the bottom sheet', async () => {
    await createCategory({ name: 'Work', color: 'blue' })
    const user = await renderHome()
    await user.click(screen.getByRole('button', { name: 'Manage labels' }))
    expect(await violations(screen.getByRole('dialog', { name: 'Labels' }))).toEqual([])
    await user.click(within(screen.getByRole('dialog', { name: 'Labels' })).getByRole('button', { name: 'Close' }))

    screenSize.desktop = false
    await user.click(screen.getByRole('button', { name: 'Add a task' }))
    expect(await violations(screen.getByRole('dialog', { name: 'Add a task' }))).toEqual([])
  })

  it('has exactly one h1', async () => {
    await renderHome()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})

describe('keyboard', () => {
  it('lets an empty text field\'s Ctrl+Z undo a delete, since the field has nothing to undo', async () => {
    await add({ title: 'Bring back' })
    const user = await renderHome()
    await user.click(screen.getByRole('button', { name: 'Delete "Bring back"' }))
    await waitFor(async () => expect((await listTasks()).some(t => t.title === 'Bring back')).toBe(false))
    await user.click(screen.getByLabelText('New task'))
    await user.keyboard('{Control>}z{/Control}')
    await waitFor(async () => expect((await listTasks()).some(t => t.title === 'Bring back')).toBe(true))
  })

  it('starts with a skip link that moves focus to the task list', async () => {
    const user = await renderHome()
    await user.tab()
    const skip = screen.getByRole('link', { name: 'Skip to tasks' })
    expect(skip).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(document.getElementById('tasks')).toHaveFocus()
  })

  it('keeps focus on a task when completing it moves it to Done, and announces it', async () => {
    await add({ title: 'Finish me' })
    const user = await renderHome()
    screen.getByRole('checkbox', { name: 'Finish me' }).focus()
    await user.keyboard(' ')

    await waitFor(() => expect(within(screen.getByRole('region', { name: /^Done/ })).getByRole('checkbox', { name: 'Finish me' })).toHaveFocus())
    expect(screen.getAllByRole('status').some(s => s.textContent?.includes('Completed "Finish me"'))).toBe(true)
  })

  it('undoes a delete with Ctrl+Z while the toast offers Undo', async () => {
    await add({ title: 'Oops' })
    const user = await renderHome()
    await user.click(screen.getByRole('button', { name: 'Delete "Oops"' }))
    await waitFor(async () => expect((await listTasks()).some(t => t.title === 'Oops')).toBe(false))
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveAttribute('aria-keyshortcuts', 'Control+Z Meta+Z')

    await user.keyboard('{Control>}z{/Control}')
    await waitFor(async () => expect((await listTasks()).some(t => t.title === 'Oops')).toBe(true))
  })

  it('leaves Ctrl+Z to a text field that has text in it', async () => {
    await add({ title: 'Keep deleted' })
    const user = await renderHome()
    await user.click(screen.getByRole('button', { name: 'Delete "Keep deleted"' }))
    await waitFor(async () => expect((await listTasks()).some(t => t.title === 'Keep deleted')).toBe(false))
    await user.type(screen.getByLabelText('New task'), 'half-typed')
    await user.keyboard('{Control>}z{/Control}')
    await new Promise(r => setTimeout(r, 100))
    expect((await getDb().tasks.where('ownerId').equals('guest').filter(t => t.title === 'Keep deleted').first())?.deletedAt).not.toBeNull()
  })
})
