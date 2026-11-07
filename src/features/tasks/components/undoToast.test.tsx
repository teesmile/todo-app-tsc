import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UNDO_WINDOW_MS } from '../store/repository'
import { UndoToast } from './undoToast'

const toast = { id: 't1', message: 'Deleted "Pay rent"', action: { label: 'Undo', run: () => {} } }

describe('undoToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps its live region mounted when empty, so the first toast is announced', () => {
    render(<UndoToast toast={null} onClose={() => {}} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('closes after the undo window', () => {
    const onClose = vi.fn()
    render(<UndoToast toast={toast} onClose={onClose} />)
    act(() => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS - 1)
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('pauses while focused, and resumes with the time that was left', () => {
    const onClose = vi.fn()
    render(<UndoToast toast={toast} onClose={onClose} />)
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    fireEvent.focus(screen.getByRole('button', { name: 'Undo' }))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.blur(screen.getByRole('button', { name: 'Undo' }))
    act(() => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS - 4000)
    })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
