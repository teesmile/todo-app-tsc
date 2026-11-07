'use client'

import type { Category, CategoryColor } from '../store/types'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useAction } from '../hooks/useAction'
import { PALETTE } from '../lib/palette'
import { CategoryConflictError, createCategory, MAX_CATEGORY_NAME_LENGTH, removeCategory, updateCategory } from '../store/repository'
import { CATEGORY_COLORS } from '../store/types'

function errorText(error: unknown) {
  if (error instanceof CategoryConflictError)
    return `Renamed in another tab to "${error.currentName}". Press Enter to keep yours, or Escape to keep theirs.`
  return error instanceof Error ? error.message : 'That couldn\'t be saved. Try again.'
}

function ColourSelect({ value, onChange, label }: { value: CategoryColor, onChange: (c: CategoryColor) => void, label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={e => onChange(e.target.value as CategoryColor)}
      className="min-h-11 rounded-lg border border-gray-300 bg-white px-2 text-sm md:min-h-9"
    >
      {CATEGORY_COLORS.map(c => <option key={c} value={c}>{PALETTE[c].name}</option>)}
    </select>
  )
}

function LabelRow({ category, uses }: { category: Category, uses: number }) {
  // While untouched, the field mirrors the stored name, so a rename in
  // another tab shows up and leaving the field writes nothing (review of
  // Phase 7). `base` is the name the edit started from, for compare-and-set.
  const [edit, setEdit] = useState<{ draft: string, base: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const save = useAction(updateCategory)
  const drop = useAction(removeCategory)

  async function rename() {
    if (!edit)
      return
    if (edit.draft.trim() === edit.base) {
      setEdit(null)
      return
    }
    const submitted = edit.draft
    try {
      const saved = await save.run(category.id, { name: submitted }, { expectName: edit.base })
      // Clear only if nothing was typed meanwhile; otherwise keep the newer
      // text, now based on the saved name (review of Phase 8).
      setEdit(current => (!current || current.draft === submitted ? null : { ...current, base: saved.name }))
    }
    catch (error) {
      // Shown below. After a conflict the next Enter knowingly replaces it.
      if (error instanceof CategoryConflictError)
        setEdit(e => (e ? { ...e, base: error.currentName } : e))
    }
  }

  return (
    <li className="rounded-xl bg-gray-50 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-3 w-3 shrink-0 rounded-full ${PALETTE[category.color].dot}`} aria-hidden="true" />
        <input
          type="text"
          value={edit ? edit.draft : category.name}
          maxLength={MAX_CATEGORY_NAME_LENGTH}
          onChange={e => setEdit({ draft: e.target.value, base: edit?.base ?? category.name })}
          onBlur={() => {
            // A conflict is decided by Enter or Escape, not by leaving the field.
            if (!(save.error instanceof CategoryConflictError))
              rename()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              rename()
            }
            else if (e.key === 'Escape' && edit) {
              // Keep the stored name; don't close the dialog as well.
              e.preventDefault()
              e.stopPropagation()
              setEdit(null)
              save.reset()
            }
          }}
          aria-label={`Name of label "${category.name}"`}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm md:min-h-9"
        />
        <ColourSelect value={category.color} onChange={color => save.fire(category.id, { color })} label={`Colour of label "${category.name}"`} />
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 md:min-h-9"
          >
            {`Delete "${category.name}"`}
          </button>
        )}
      </div>
      {confirming && (
        <div role="group" aria-label={`Confirm deleting "${category.name}"`} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <p className="text-gray-800">
            {uses === 0 ? 'No tasks use it.' : `It's on ${uses} task${uses === 1 ? '' : 's'}; they keep everything else.`}
          </p>
          <button type="button" onClick={() => drop.fire(category.id)} className="min-h-11 rounded-lg bg-red-600 px-3 font-medium text-white hover:bg-red-700 md:min-h-9">
            Delete label
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-lg px-3 font-medium text-gray-700 hover:bg-gray-100 md:min-h-9">
            Keep it
          </button>
        </div>
      )}
      {Boolean(save.error ?? drop.error) && <p role="alert" className="mt-1 text-sm text-red-600">{errorText(save.error ?? drop.error)}</p>}
    </li>
  )
}

interface LabelManagerProps {
  open: boolean
  onClose: () => void
  categories: Category[]
  /** How many live tasks use each label id. */
  uses: Map<string, number>
}

/**
 * Create, rename, recolour and delete labels, in a native modal <dialog>.
 * Deleting asks first and says how many tasks use the label.
 */
export function LabelManager({ open, onClose, categories, uses }: LabelManagerProps) {
  const id = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<CategoryColor>('blue')
  const create = useAction(createCategory)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog)
      return
    if (open && !dialog.open) {
      dialog.showModal()
      nameRef.current?.focus()
    }
    else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget)
          onClose()
      }}
      className="m-auto max-h-[85dvh] w-[min(32rem,calc(100%-2rem))] rounded-2xl bg-white p-4 shadow-xl backdrop:bg-black/40"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 id={`${id}-title`} className="text-lg font-semibold text-gray-900">Labels</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const submitted = name
          try {
            await create.run({ name: submitted, color })
            // Text typed while it was saving is the next label: keep it.
            setName(current => (current === submitted ? '' : current))
            nameRef.current?.focus()
          }
          catch {
            // Shown below; the name stays.
          }
        }}
        className="mb-4 space-y-2"
      >
        <label htmlFor={`${id}-name`} className="block text-sm font-medium text-gray-700">New label</label>
        <div className="flex flex-wrap gap-2">
          <input
            ref={nameRef}
            id={`${id}-name`}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={MAX_CATEGORY_NAME_LENGTH}
            placeholder="e.g. Work"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3"
          />
          <ColourSelect value={color} onChange={setColor} label="Colour of the new label" />
          <button type="submit" disabled={!name.trim() || create.pending} className="min-h-11 rounded-lg bg-orange-600 px-4 font-medium text-white hover:bg-orange-700 disabled:opacity-50">
            Add label
          </button>
        </div>
        {Boolean(create.error) && <p role="alert" className="text-sm text-red-600">{errorText(create.error)}</p>}
      </form>

      {categories.length === 0
        ? <p className="text-sm text-gray-600">No labels yet. Add one above, then put it on tasks from their Label chip.</p>
        : (
            <ul className="space-y-2">
              {categories.map(c => <LabelRow key={c.id} category={c} uses={uses.get(c.id) ?? 0} />)}
            </ul>
          )}
    </dialog>
  )
}
