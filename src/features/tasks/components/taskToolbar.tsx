'use client'

import type { Ref } from 'react'
import type { TaskFilter } from '../lib/filter'
import type { TaskSort } from '../lib/group'
import type { Category } from '../store/types'
import { Search } from 'lucide-react'
import { useId } from 'react'
import { FILTER_LABELS, FILTERS } from '../lib/filter'
import { SORT_LABELS, SORTS } from '../lib/group'

interface TaskToolbarProps {
  query: string
  onQueryChange: (query: string) => void
  filter: TaskFilter
  onFilterChange: (filter: TaskFilter) => void
  /** Newest (one list) or Due date (grouped), like the filters a set of native radios. */
  sort: TaskSort
  onSortChange: (sort: TaskSort) => void
  /** How many tasks the current filter and search show, announced politely. */
  shown: number | undefined
  searchRef?: Ref<HTMLInputElement>
  categories: Category[]
  /** The label filter: a label id, or null for every label. */
  label: string | null
  onLabelChange: (label: string | null) => void
  onManageLabels: () => void
}

/**
 * Search plus the five filters. The filters are native radios in a fieldset,
 * so arrow keys move between them and a screen reader hears "Show, radio
 * group, Overdue, 3 of 5". The radios are visually hidden and the labels draw
 * the segmented control, focus ring included.
 */
export function TaskToolbar({ query, onQueryChange, filter, onFilterChange, sort, onSortChange, shown, searchRef, categories, label, onLabelChange, onManageLabels }: TaskToolbarProps) {
  const id = useId()

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${id}-search`} className="mb-1 block text-sm font-medium text-gray-700">Search tasks</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            ref={searchRef}
            id={`${id}-search`}
            type="search"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              // Escape leaves the field and keeps the search. Without
              // preventDefault, Chrome would clear it.
              if (e.key === 'Escape') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            aria-keyshortcuts="/"
            placeholder="Search (press /)"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Show and Order side by side from tablet width; stacked on phones. */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <fieldset className="w-full md:w-auto">
          <legend className="mb-1 text-sm font-medium text-gray-700">Show</legend>
          {/* Six filters: a 3×2 grid on phones, so none spills out of the card at
              360px; one compact pill from tablet width. */}
          <div className="grid w-full grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 md:inline-flex md:w-auto">
            {FILTERS.map(value => (
              <label key={value} className="min-w-0 cursor-pointer md:flex-none">
                <input
                  type="radio"
                  name={`${id}-filter`}
                  value={value}
                  checked={filter === value}
                  onChange={() => onFilterChange(value)}
                  className="peer sr-only"
                />
                <span className="block min-h-9 whitespace-nowrap rounded-md px-1.5 py-2 text-center text-sm text-gray-600 md:min-h-0 md:px-3 md:py-1 peer-checked:bg-white peer-checked:font-medium peer-checked:text-gray-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500">
                  {FILTER_LABELS[value]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-700">Order</legend>
          <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1">
            {SORTS.map(value => (
              <label key={value} className="min-w-0 cursor-pointer">
                <input
                  type="radio"
                  name={`${id}-sort`}
                  value={value}
                  checked={sort === value}
                  onChange={() => onSortChange(value)}
                  className="peer sr-only"
                />
                <span className="block min-h-9 whitespace-nowrap rounded-md px-3 py-2 text-center text-sm text-gray-600 md:min-h-0 md:py-1 peer-checked:bg-white peer-checked:font-medium peer-checked:text-gray-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-orange-500">
                  {SORT_LABELS[value]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {categories.length > 0 && (
          <div>
            <label htmlFor={`${id}-label`} className="mb-1 block text-sm font-medium text-gray-700">Label</label>
            <select
              id={`${id}-label`}
              value={label ?? ''}
              onChange={e => onLabelChange(e.target.value || null)}
              className="min-h-11 rounded-lg border border-gray-300 bg-white px-2 text-sm md:min-h-9"
            >
              <option value="">All labels</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={onManageLabels}
          aria-haspopup="dialog"
          className="min-h-11 rounded-lg px-2 text-sm font-medium text-orange-700 underline-offset-4 hover:underline md:min-h-9"
        >
          Manage labels
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {shown === undefined ? '' : `${shown} task${shown === 1 ? '' : 's'} shown`}
      </p>
    </div>
  )
}
