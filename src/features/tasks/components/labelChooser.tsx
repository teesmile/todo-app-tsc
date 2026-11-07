'use client'

import type { Category } from '../store/types'
import { Tag } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { PALETTE } from '../lib/palette'
import { useLabels } from './labelsContext'

/** The coloured chips for a task's live labels. Unknown ids are skipped. */
export function LabelChips({ ids }: { ids: string[] }) {
  const { categories } = useLabels()
  const byId = new Map(categories.map(c => [c.id, c]))
  const shown = ids.map(id => byId.get(id)).filter((c): c is Category => Boolean(c))
  if (shown.length === 0)
    return null
  return (
    <>
      {shown.map(c => (
        <span key={c.id} className={`inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium ${PALETTE[c.color].chip}`}>
          <span className={`h-2 w-2 rounded-full ${PALETTE[c.color].dot}`} aria-hidden="true" />
          {c.name}
        </span>
      ))}
    </>
  )
}

interface LabelChooserProps {
  value: string[]
  /** One membership change: add (`on`) or remove this label. */
  onToggle: (labelId: string, on: boolean) => void
  /** For the accessible name, e.g. `"Buy milk"` or "the new task". */
  subject: string
}

/**
 * A small "Label" chip that opens a checklist of labels: real checkboxes in
 * a fieldset, applied as they're ticked, plus "Manage labels…". Escape or a
 * click outside closes it, and focus returns to the chip.
 */
export function LabelChooser({ value, onToggle, subject }: LabelChooserProps) {
  const { categories, openManager } = useLabels()
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const live = new Set(categories.map(c => c.id))
  const chosen = value.filter(id => live.has(id))
  const names = categories.filter(c => chosen.includes(c.id)).map(c => c.name)

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

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div
      ref={rootRef}
      className="relative inline-block"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault()
          e.stopPropagation()
          close()
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Labels for ${subject}: ${names.length ? names.join(', ') : 'none'}`}
        onClick={() => setOpen(o => !o)}
        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
      >
        <Tag className="h-3.5 w-3.5" aria-hidden="true" />
        {/* Always "Labels", which the accessible name starts with (WCAG 2.5.3);
            the chips beside it name the labels. Icon-only on phones. */}
        <span className="hidden md:inline">Labels</span>
      </button>

      {open && (
        <div id={panelId} className="absolute left-0 z-20 mt-1 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          {categories.length === 0
            ? <p className="px-1 py-1 text-sm text-gray-600">No labels yet.</p>
            : (
                <fieldset>
                  <legend className="sr-only">{`Labels for ${subject}`}</legend>
                  <ul className="max-h-60 overflow-y-auto">
                    {categories.map(c => (
                      <li key={c.id}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-gray-800 hover:bg-gray-100 md:min-h-9">
                          <input
                            type="checkbox"
                            checked={chosen.includes(c.id)}
                            onChange={e => onToggle(c.id, e.target.checked)}
                            className="h-4 w-4 accent-orange-500"
                          />
                          <span className={`h-2.5 w-2.5 rounded-full ${PALETTE[c.color].dot}`} aria-hidden="true" />
                          {c.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              )}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              openManager()
            }}
            className="mt-1 block min-h-11 w-full rounded-lg px-2 text-left text-sm font-medium text-orange-700 hover:bg-orange-50 md:min-h-9"
          >
            Manage labels…
          </button>
        </div>
      )}
    </div>
  )
}
