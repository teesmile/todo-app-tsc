import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetLegacyImportForTests, retryLegacyImport, useLegacyImport } from './hooks'
import { runLegacyImport } from './legacyImport'

vi.mock('./legacyImport', () => ({ runLegacyImport: vi.fn() }))
const run = vi.mocked(runLegacyImport)

describe('useLegacyImport', () => {
  afterEach(() => {
    resetLegacyImportForTests()
    run.mockReset()
  })

  it('reports a failed import, and a retry can succeed without a reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    run.mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce({ status: 'no-legacy-db' })

    const { result } = renderHook(() => useLegacyImport())
    await waitFor(() => expect(result.current).toBe('failed'))

    await act(() => retryLegacyImport())
    expect(result.current).toBe('done')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('reports blocked while an old tab holds the database, then done', async () => {
    let finish!: () => void
    run.mockImplementationOnce(({ onBlocked } = {}) => new Promise((resolve) => {
      onBlocked?.()
      finish = () => resolve({ status: 'imported', imported: 1, skipped: 0 })
    }))

    const { result } = renderHook(() => useLegacyImport())
    await waitFor(() => expect(result.current).toBe('blocked'))
    await act(async () => finish())
    expect(result.current).toBe('done')
  })

  it('runs once, however many components ask', async () => {
    run.mockResolvedValue({ status: 'no-legacy-db' })
    renderHook(() => useLegacyImport())
    renderHook(() => useLegacyImport())
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1))
  })
})
