import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getDb } from '@/features/tasks/store/db'
import { add, listTasks, MAX_TITLE_LENGTH } from '@/features/tasks/store/repository'
import { AddTodoForm } from '../components/addTodoForm'
import { EditTodoForm } from '../components/editTodoForm'

describe('addTodoForm', () => {
  it('shows the length limit as an alert, keeps the draft, and saves nothing', async () => {
    render(<AddTodoForm />)
    const field = screen.getByLabelText('Todo Description')
    expect(field).toHaveAttribute('maxLength', String(MAX_TITLE_LENGTH))

    // Set the value directly, the way a paste or autofill can, past maxLength.
    const tooLong = 'x'.repeat(MAX_TITLE_LENGTH + 1)
    fireEvent.change(field, { target: { value: tooLong } })
    fireEvent.submit(field.closest('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent(`at most ${MAX_TITLE_LENGTH} characters`)
    expect(field).toHaveValue(tooLong)
    expect((await listTasks()).filter(t => t.isSample === 0)).toHaveLength(0)
  })

  it('shows a storage failure as an alert and keeps the draft', async () => {
    vi.spyOn(getDb().tasks, 'add').mockRejectedValueOnce(new DOMException('Quota exceeded', 'QuotaExceededError'))
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(<AddTodoForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Todo Description'), 'Buy stamps')
    await user.click(screen.getByRole('button', { name: 'Create Todo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your text is still here')
    expect(screen.getByLabelText('Todo Description')).toHaveValue('Buy stamps')
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

describe('editTodoForm', () => {
  it('shows a failed save as an alert and keeps the edit', async () => {
    const task = await add({ title: 'Renew library card' })
    vi.spyOn(getDb().tasks, 'put').mockRejectedValueOnce(new DOMException('Quota exceeded', 'QuotaExceededError'))
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditTodoForm todo={task} onSave={onSave} onCancel={() => {}} />)

    const field = screen.getByLabelText('Edit "Renew library card"')
    await user.clear(field)
    await user.type(field, 'Renew library card online')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your text is still here')
    expect(field).toHaveValue('Renew library card online')
    expect(onSave).not.toHaveBeenCalled()
  })
})
