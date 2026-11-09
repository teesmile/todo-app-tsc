'use client'

import type { TaskFilter } from '../lib/filter'
import type { TaskSort } from '../lib/group'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isTaskFilter } from '../lib/filter'
import { isTaskSort } from '../lib/group'

const URL_DEBOUNCE_MS = 300

interface ListView {
  filter: TaskFilter
  query: string
  label: string | null
  sort: TaskSort
}

function writeUrl({ filter, query, label, sort }: ListView) {
  const url = new URL(window.location.href)
  if (label)
    url.searchParams.set('label', label)
  else
    url.searchParams.delete('label')
  if (filter === 'all')
    url.searchParams.delete('filter')
  else
    url.searchParams.set('filter', filter)
  if (query.trim())
    url.searchParams.set('q', query)
  else
    url.searchParams.delete('q')
  // Newest is the default, so only the grouped view is written.
  if (sort === 'newest')
    url.searchParams.delete('sort')
  else
    url.searchParams.set('sort', sort)
  // Replace, not push: reload and shared links keep the view, and Back still
  // leaves the page instead of stepping through every filter click.
  window.history.replaceState(window.history.state, '', url)
}

/**
 * The list's filter, search, label and order, read once from
 * `?filter=&q=&label=&sort=` and written back to it. Filtering uses the state
 * straight away; only the URL write for the search is debounced, so results
 * never lag behind typing.
 */
export function useListParams() {
  const params = useSearchParams()
  const [filter, setFilterState] = useState<TaskFilter>(() => {
    const fromUrl = params.get('filter')
    return isTaskFilter(fromUrl) ? fromUrl : 'all'
  })
  const [query, setQueryState] = useState(() => params.get('q') ?? '')
  const [label, setLabelState] = useState<string | null>(() => params.get('label') || null)
  const [sort, setSortState] = useState<TaskSort>(() => {
    const fromUrl = params.get('sort')
    return isTaskSort(fromUrl) ? fromUrl : 'newest'
  })
  const latest = useRef<ListView>({ filter, query, label, sort })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const setFilter = useCallback((next: TaskFilter) => {
    latest.current.filter = next
    setFilterState(next)
    clearTimeout(timer.current)
    writeUrl(latest.current)
  }, [])

  const setLabel = useCallback((next: string | null) => {
    latest.current.label = next
    setLabelState(next)
    clearTimeout(timer.current)
    writeUrl(latest.current)
  }, [])

  const setSort = useCallback((next: TaskSort) => {
    latest.current.sort = next
    setSortState(next)
    clearTimeout(timer.current)
    writeUrl(latest.current)
  }, [])

  const setQuery = useCallback((next: string) => {
    latest.current.query = next
    setQueryState(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => writeUrl(latest.current), URL_DEBOUNCE_MS)
  }, [])

  return { filter, setFilter, query, setQuery, label, setLabel, sort, setSort }
}
