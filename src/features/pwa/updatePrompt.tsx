'use client'

import type { ContainerLike } from './serviceWorker'
import { useEffect, useState } from 'react'
import { registerServiceWorker } from './serviceWorker'

/**
 * Registers the service worker in production builds and, when a new version
 * is waiting, says so with a Reload button, rather than swapping code under
 * an open page. Checks for a new version whenever the tab is shown again.
 */
// NODE_ENV is inlined by Next only as the global `process.env.NODE_ENV`.
// eslint-disable-next-line node/prefer-global/process
const PRODUCTION = process.env.NODE_ENV === 'production'

export function UpdatePrompt({ container, enabled = PRODUCTION }: { container?: ContainerLike, enabled?: boolean }) {
  const [apply, setApply] = useState<(() => void) | null>(null)

  useEffect(() => {
    const sw = container ?? (typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker as unknown as ContainerLike : null)
    if (!enabled || !sw)
      return
    let cancelled = false
    let onVisible = () => {}
    registerServiceWorker(sw, {
      onUpdate: next => !cancelled && setApply(() => next),
      reload: () => window.location.reload(),
    }).then((registration) => {
      if (cancelled)
        return
      onVisible = () => {
        if (document.visibilityState === 'visible')
          void registration.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', onVisible)
    }).catch(() => {
      // No service worker (unsupported, blocked, or offline at first visit): the app still works online.
    })
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [container, enabled])

  return (
    <div role="status" className="empty:hidden">
      {apply && (
        <div className="border-b border-gray-200 bg-gray-900 px-4 py-2 text-sm text-white">
          <p className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
            <span>Update available.</span>
            <button type="button" onClick={apply} className="min-h-11 rounded-lg bg-white px-4 font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
              Reload
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
