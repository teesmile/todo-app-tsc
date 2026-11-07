import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { msUntilNextMidnight, useToday } from './useToday'

describe('useToday', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rolls over to the new date just after midnight, without a reload', () => {
    vi.useFakeTimers({ now: new Date(2026, 11, 31, 23, 59, 30) })
    const { result } = renderHook(() => useToday())
    expect(result.current).toBe('2026-12-31')

    act(() => {
      vi.advanceTimersByTime(31_000)
    })
    expect(result.current).toBe('2027-01-01')
  })

  it('times the next check for just after local midnight', () => {
    expect(msUntilNextMidnight(new Date(2026, 10, 7, 23, 0, 0))).toBe(60 * 60 * 1000 + 50)
  })
})
