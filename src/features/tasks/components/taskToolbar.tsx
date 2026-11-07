'use client'

import type { Ref } from 'react'
import type { TaskFilter } from '../lib/filter'
import { Search } from 'lucide-react'
import { useId } from 'react'
import { FILTER_LABELS, FILTERS } from '../lib/filter'

interface TaskToolbarProps {
  query: string
  onQueryChange: (query: string) => void
  filter: TaskFilter
  onFilterChange: (filter: TaskFilter) => void
  /** How many tasks the current filter and search show, announced politely. */
  shown: number | undefined
  searchRef?: Ref<HTMLInputElement>
}

/**
 * Search plus the five filters. The filters are native radios in a fieldset,
 * so arrow keys move between them and a screen reader hears "Show, radio
 * group, Overdue, 3 of 5". The radios are visually hidden and the labels draw
 * the segmented control, focus ring included.
 */
export function TaskToolbar({ query, onQueryChange, filter, onFilterChange, shown, searchRef }: TaskToolbarProps) {
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

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-gray-700">Show</legend>
        {/* Full width on phones, each segment its natural width plus a share of
            what's left, so all five fit on one line down to 360px; a compact
            pill from tablet width. */}
        <div className="flex w-full gap-1 rounded-lg bg-gray-100 p-1 md:inline-flex md:w-auto">
          {FILTERS.map(value => (
            <label key={value} className="flex-auto cursor-pointer md:flex-none">
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

      <p aria-live="polite" className="sr-only">
        {shown === undefined ? '' : `${shown} task${shown === 1 ? '' : 's'} shown`}
      </p>
    </div>
  )
}
