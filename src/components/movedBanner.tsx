'use client'

import { useSyncExternalStore } from 'react'
import { movedTo } from '@/config/site'

const noSubscription = () => () => {}

/**
 * Shown only on an old address. That address keeps serving the app, because
 * IndexedDB is per address: a redirect would strand the tasks stored there.
 * Nothing on the server (the static page is the same for every host), so it
 * appears once the page runs.
 */
export function MovedBanner({ location }: { location?: { hostname: string, pathname: string, search: string } }) {
  const target = useSyncExternalStore(noSubscription, () => movedTo(location ?? window.location), () => null)
  if (!target)
    return null
  return (
    <aside aria-label="New address" className="border-b border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950">
      <p className="mx-auto max-w-5xl">
        Todo App has moved to
        {' '}
        <a href={target} className="font-semibold underline underline-offset-2">todo.anthonyugwuja.dev</a>
        . Your tasks here are safe: sign in with Google to take them with you, then continue at the new address.
      </p>
    </aside>
  )
}
