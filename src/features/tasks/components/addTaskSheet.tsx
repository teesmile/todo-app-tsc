'use client'

import type { Task } from '../store/types'
import { Plus, X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { AddTaskForm } from './addTaskForm'

interface AddTaskSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  today: string
  defaultDue: string | null
  onAdded: (task: Task) => void
}

/**
 * On phones: a floating Add button that opens the add form in a bottom
 * sheet. The sheet is a native <dialog> opened with showModal(), which gives
 * a focus trap, Escape to close, an inert page behind it and a backdrop, with
 * no library. The form is only mounted while the sheet is open, so its title
 * field takes focus each time. Adding closes the sheet; focus returns to the
 * Add button.
 */
export function AddTaskSheet({ open, onOpenChange, today, defaultDue, onAdded }: AddTaskSheetProps) {
  const headingId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const wasOpen = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog)
      return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal() moves focus to the dialog's first control (Close), and it
      // runs after the form mounted, so the title has to be focused here.
      titleRef.current?.focus()
    }
    else if (!open && dialog.open) {
      dialog.close()
    }
    // However it closed (Escape, the backdrop, Close, or after adding), put
    // focus back on the button that opened it. Browsers differ on doing this.
    if (wasOpen.current && !open)
      fabRef.current?.focus()
    wasOpen.current = open
  }, [open])

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label="Add a task"
        aria-haspopup="dialog"
        aria-keyshortcuts="n"
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg hover:bg-orange-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 md:hidden"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={headingId}
        // The native close (Escape) has to update our state too.
        onClose={() => onOpenChange(false)}
        // A tap on the backdrop lands on the <dialog> element itself.
        onClick={(e) => {
          if (e.target === e.currentTarget)
            onOpenChange(false)
        }}
        className="sheet fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl backdrop:bg-black/40"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id={headingId} className="text-lg font-semibold text-gray-900">Add a task</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {open && (
          <AddTaskForm
            titleRef={titleRef}
            today={today}
            defaultDue={defaultDue}
            autoFocus
            onAdded={(task, { draftLeft }) => {
              // Text typed while the add was saving is the next task: keep the
              // sheet open for it rather than unmounting it (Codex review of
              // Phases 4-6).
              if (!draftLeft)
                onOpenChange(false)
              onAdded(task)
            }}
          />
        )}
      </dialog>
    </>
  )
}
