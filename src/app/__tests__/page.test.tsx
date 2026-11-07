import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetLegacyImportForTests } from '@/features/tasks/store/hooks'
import { runLegacyImport } from '@/features/tasks/store/legacyImport'
import Home from '../page'

vi.mock('@/features/tasks/store/legacyImport', () => ({ runLegacyImport: vi.fn() }))
const run = vi.mocked(runLegacyImport)

describe('home page', () => {
  it('labels each stats ring with its numbers in words', async () => {
    run.mockResolvedValue({ status: 'no-legacy-db' })
    render(<Home />)
    expect(await screen.findByRole('img', { name: '0% completed: 0 of 5 tasks done' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '100% in progress: 5 of 5 tasks open' })).toBeInTheDocument()
    expect(screen.getByText('Overdue', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Due today', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1')
  })

  afterEach(() => {
    resetLegacyImportForTests()
    run.mockReset()
  })

  it('says a failed import kept the old tasks, and Try again re-runs it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    run.mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce({ status: 'imported', imported: 1, skipped: 0 })
    const user = userEvent.setup()
    render(<Home />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('still saved on this device')

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.queryByText(/couldn.t be brought over/)).not.toBeInTheDocument())
    expect(run).toHaveBeenCalledTimes(2)
  })
})
