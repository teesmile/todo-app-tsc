'use client'

import { CalendarDays } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { formatDue, nextDay } from '../lib/dates'

interface DueChooserProps {
  value: string | null
  onChange: (value: string | null) => void
  today: string
  /** What the date belongs to, for the accessible name: a task title, or "the new task". */
  subject: string
  disabled?: boolean
}

/**
 * The due date as a small, secondary chip. It reads "Due" when there's no date
 * and "Due today", "Overdue · Mon 3 Nov" and so on when there is one. It opens
 * a short list of real buttons (Today, Tomorrow, Pick a date, No due date),
 * not an ARIA menu, so it works the way buttons do with no extra keyboard
 * model to learn. Escape or a click outside closes it, and focus returns to
 * the chip.
 */
export function DueChooser({ value, onChange, today, subject, disabled }: DueChooserProps) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  const label = value ? formatDue(value, today) : 'Due'
  const overdue = value !== null && value < today

  useEffect(() => {
    if (!open)
      return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node))
        setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (picking)
      dateRef.current?.focus()
  }, [picking])

  function close() {
    setOpen(false)
    setPicking(false)
    triggerRef.current?.focus()
  }

  function choose(next: string | null) {
    onChange(next)
    close()
  }

  return (
    <div
      ref={rootRef}
      className="relative inline-block"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          // Don't let Escape also close a surrounding sheet.
          e.preventDefault()
          e.stopPropagation()
          close()
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Due date for ${subject}: ${value ? label.replace(/^Due /, '') : 'none'}`}
        onClick={() => {
          setPicking(false)
          setOpen(o => !o)
        }}
        className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50 ${
          overdue
            ? 'border-red-200 bg-red-50 text-red-700'
            : value
              ? 'border-orange-200 bg-orange-50 text-orange-800'
              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute left-0 z-20 mt-1 w-48 rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
        >
          {picking
            ? (
                <label className="block p-2 text-xs font-medium text-gray-700">
                  Pick a date
                  <input
                    ref={dateRef}
                    type="date"
                    defaultValue={value ?? today}
                    onChange={(e) => {
                      if (e.target.value)
                        choose(e.target.value)
                    }}
                    className="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
              )
            : (
                <ul className="text-sm">
                  {[
                    { text: 'Today', act: () => choose(today) },
                    { text: 'Tomorrow', act: () => choose(nextDay(today)) },
                    { text: 'Pick a date…', act: () => setPicking(true) },
                    ...(value ? [{ text: 'No due date', act: () => choose(null) }] : []),
                  ].map(({ text, act }) => (
                    <li key={text}>
                      <button
                        type="button"
                        onClick={act}
                        className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 md:min-h-0"
                      >
                        {text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </div>
      )}
    </div>
  )
}
