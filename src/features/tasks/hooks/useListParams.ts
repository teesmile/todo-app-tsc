'use client'

import type { TaskFilter } from '../lib/filter'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isTaskFilter } from '../lib/filter'

const URL_DEBOUNCE_MS = 300

function writeUrl(filter: TaskFilter, query: string) {
  const url = new URL(window.location.href)
  if (filter === 'all')
    url.searchParams.delete('filter')
  else
    url.searchParams.set('filter', filter)
  if (query.trim())
    url.searchParams.set('q', query)
  else
    url.searchParams.delete('q')
  // Replace, not push: reload and shared links keep the view, and Back still
  // leaves the page instead of stepping through every filter click.
  window.history.replaceState(window.history.state, '', url)
}

/**
 * The list's filter and search, read once from `?filter=&q=` and written back
 * to it. Filtering uses the state straight away; only the URL write for the
 * search is debounced, so results never lag behind typing.
 */
export function useListParams() {
  const params = useSearchParams()
  const [filter, setFilterState] = useState<TaskFilter>(() => {
    const fromUrl = params.get('filter')
    return isTaskFilter(fromUrl) ? fromUrl : 'all'
  })
  const [query, setQueryState] = useState(() => params.get('q') ?? '')
  const latest = useRef({ filter, query })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const setFilter = useCallback((next: TaskFilter) => {
    latest.current.filter = next
    setFilterState(next)
    clearTimeout(timer.current)
    writeUrl(next, latest.current.query)
  }, [])

  const setQuery = useCallback((next: string) => {
    latest.current.query = next
    setQueryState(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => writeUrl(latest.current.filter, latest.current.query), URL_DEBOUNCE_MS)
  }, [])

  return { filter, setFilter, query, setQuery }
}
