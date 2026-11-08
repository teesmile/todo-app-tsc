import type { Task } from '../store/types'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextDay, toLocalDateString } from '../lib/dates'
import { getDb } from '../store/db'
import { add } from '../store/repository'
import { TaskItem } from './taskItem'

const today = toLocalDateString(new Date())
const stored = async (id: string) => (await getDb().tasks.get(id))!

async function renderItem(overrides: Partial<Task> = {}) {
  const task = { ...(await add({ title: 'Buy oat milk' })), ...overrides }
  const onDelete = vi.fn()
  const user = userEvent.setup()
  const view = render(<TaskItem task={task} onDelete={onDelete} today={today} now={new Date()} />)
  return { task, onDelete, user, ...view }
}

describe('taskItem', () => {
  it('has a real checkbox named by the title, and completes the task', async () => {
    const { task, user } = await renderItem()
    const checkbox = screen.getByRole('checkbox', { name: 'Buy oat milk' })
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)
    await waitFor(async () => expect((await stored(task.id)).completed).toBe(true))
  })

  it('saves an edit on Enter and puts focus back on the title', async () => {
    const { task, user } = await renderItem()
    await user.click(screen.getByRole('button', { name: 'Edit "Buy oat milk"' }))
    const field = screen.getByRole('textbox', { name: 'Edit "Buy oat milk"' })
    expect(field).toHaveFocus()

    await user.clear(field)
    await user.type(field, 'Buy oat milk and bread{Enter}')

    await waitFor(async () => expect((await stored(task.id)).title).toBe('Buy oat milk and bread'))
    // The editor closes when the save's promise resumes in the component, a tick after the write lands.
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())
    // The save resolves outside act(), so the focus effect can land a tick later.
    await waitFor(() => expect(screen.getByRole('button', { name: /^Edit "/ })).toHaveFocus())
  })

  it('saves an edit when the field loses focus', async () => {
    const { task, user } = await renderItem()
    await user.click(screen.getByRole('button', { name: 'Edit "Buy oat milk"' }))
    await user.type(screen.getByRole('textbox'), ' (2 litres)')
    await user.tab()

    await waitFor(async () => expect((await stored(task.id)).title).toBe('Buy oat milk (2 litres)'))
  })

  it('cancels on Escape without saving, even though focus then leaves the field', async () => {
    const { task, user } = await renderItem()
    const revBefore = (await stored(task.id)).rev
    await user.click(screen.getByRole('button', { name: 'Edit "Buy oat milk"' }))
    await user.type(screen.getByRole('textbox'), ' never saved{Escape}')

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    const after = await stored(task.id)
    expect(after.title).toBe('Buy oat milk')
    expect(after.rev).toBe(revBefore)
  })

  it('keeps the field open with an alert when the edit is empty', async () => {
    const { task, user } = await renderItem()
    await user.click(screen.getByRole('button', { name: 'Edit "Buy oat milk"' }))
    await user.clear(screen.getByRole('textbox'))
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('A task needs a title')
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect((await stored(task.id)).title).toBe('Buy oat milk')
  })

  it('shows when it was added, automatically', async () => {
    await renderItem()
    expect(screen.getByText(/^Added today, \d{1,2}:\d{2}$/)).toBeInTheDocument()
  })

  it('sets the due date from a small Due chip: Today, Tomorrow, or none', async () => {
    const { task, user } = await renderItem()
    const chip = () => screen.getByRole('button', { name: /due date for "Buy oat milk"/i })
    expect(chip()).toHaveAccessibleName('Due date for "Buy oat milk": none')
    expect(screen.queryByDisplayValue(today)).not.toBeInTheDocument()

    await user.click(chip())
    await user.click(screen.getByRole('button', { name: 'Tomorrow' }))
    await waitFor(async () => expect((await stored(task.id)).dueDate).toBe(nextDay(today)))
    expect(chip()).toHaveFocus()
  })

  it('picks any date from the chip with a native date input', async () => {
    const { task, user } = await renderItem()
    await user.click(screen.getByRole('button', { name: /due date for/i }))
    await user.click(screen.getByRole('button', { name: 'Pick a date…' }))
    const date = screen.getByLabelText('Pick a date')
    expect(date).toHaveAttribute('type', 'date')
    expect(date).toHaveFocus()
    fireEvent.change(date, { target: { value: '2026-12-24' } })
    await waitFor(async () => expect((await stored(task.id)).dueDate).toBe('2026-12-24'))
  })

  it('clears a due date, and closes the chooser on Escape with focus back on the chip', async () => {
    const { task, user } = await renderItem({ dueDate: today })
    const chip = screen.getByRole('button', { name: /due date for/i })
    expect(chip).toHaveTextContent('Due today')

    await user.click(chip)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'Tomorrow' })).not.toBeInTheDocument()
    expect(chip).toHaveFocus()

    await user.click(chip)
    await user.click(screen.getByRole('button', { name: 'No due date' }))
    await waitFor(async () => expect((await stored(task.id)).dueDate).toBeNull())
  })

  it('asks the list to delete it from a button named for the task', async () => {
    const { task, onDelete, user } = await renderItem()
    await user.click(screen.getByRole('button', { name: 'Delete "Buy oat milk"' }))
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(task)
  })
})
