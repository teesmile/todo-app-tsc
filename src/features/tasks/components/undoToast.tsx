'use client'

import { useEffect, useRef, useState } from 'react'
import { UNDO_WINDOW_MS } from '../store/repository'

export interface Toast {
  /** New for every toast, so a replaced toast restarts its timer. */
  id: string
  message: string
  /** One optional button: Undo after a delete, Show all for a hidden task. */
  action?: { label: string, run: () => void }
  durationMs?: number
}

/**
 * A toast in a polite live region. The region is always mounted, because
 * screen readers announce changes to a region that already exists, not one
 * that appears with its content. The timer pauses while the pointer or
 * keyboard focus is on the toast (WCAG 2.2.1), so nobody has to race it to
 * reach Undo.
 */
export function UndoToast({ toast, onClose }: { toast: Toast | null, onClose: () => void }) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(0)
  const startedAt = useRef(0)

  useEffect(() => {
    remaining.current = toast?.durationMs ?? UNDO_WINDOW_MS
  }, [toast])

  useEffect(() => {
    if (!toast || paused)
      return
    startedAt.current = Date.now()
    const timer = setTimeout(onClose, remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current -= Date.now() - startedAt.current
    }
  }, [toast, paused, onClose])

  return (
    <div
      role="status"
      aria-live="polite"
      // Above the floating Add button on phones.
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-4"
    >
      {toast && (
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="pointer-events-auto flex items-center gap-4 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={toast.action.run}
              className="rounded px-2 py-1 font-semibold text-orange-300 hover:text-orange-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
