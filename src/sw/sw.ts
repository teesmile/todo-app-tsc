import { acceptForPrecache, routeFor } from './routing'

/**
 * The service worker (Phase 11), bundled into out/sw.js by
 * scripts/build-sw.mjs after `next build`, which also fills in the two
 * constants below from the exported files.
 *
 * - Install: precache every file the static export emits, so the app works
 *   offline from the first visit, including chunks never opened yet.
 * - Activate: keep this version's cache and the one before it (tabs that
 *   haven't reloaded yet still need its files); delete older ones.
 * - Fetch: see routing.ts. Other origins (Supabase, Google) are never
 *   intercepted, so no token or task row ever lands in a cache.
 * - Updates: a new version waits until the page asks it to take over
 *   ("Update available: Reload"), never swapping code under an open page.
 */

declare const __PRECACHE__: string[]
declare const __VERSION__: string

// The few service-worker types used here. Declared locally: the DOM and
// WebWorker type libraries conflict in one TypeScript project.
interface ExtendableEvent extends Event { waitUntil: (promise: Promise<unknown>) => void }
interface FetchEvent extends ExtendableEvent { request: Request, respondWith: (response: Promise<Response>) => void }
interface MessageEvent extends ExtendableEvent { data: unknown }
interface Worker {
  location: Location
  skipWaiting: () => Promise<void>
  clients: { claim: () => Promise<void> }
  addEventListener: ((type: 'install' | 'activate', listener: (event: ExtendableEvent) => void) => void)
    & ((type: 'fetch', listener: (event: FetchEvent) => void) => void)
    & ((type: 'message', listener: (event: MessageEvent) => void) => void)
}

const worker = globalThis as unknown as Worker
const CACHE_PREFIX = 'todo-app-'
const CACHE = `${CACHE_PREFIX}${__VERSION__}`
const PRECACHED = new Set(__PRECACHE__)

worker.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    // One by one rather than addAll: the 404 page arrives with status 404.
    // Any other failure rejects, so the install fails and the old version
    // stays in charge rather than a half-filled cache.
    await Promise.all(__PRECACHE__.map(async (url) => {
      // `reload`: a fresh copy, never one from the HTTP cache.
      const response = await fetch(new Request(url, { cache: 'reload' }))
      if (!acceptForPrecache(url, response.status))
        throw new Error(`precache: ${url} answered ${response.status}`)
      // A followed redirect can't answer a navigation, so store a plain copy.
      await cache.put(url, response.redirected ? new Response(response.body, response) : response)
    }))
  })())
})

worker.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // keys() lists caches oldest first, so the last other one is the
    // version this replaces.
    const older = (await caches.keys()).filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE)
    for (const name of older.slice(0, -1))
      await caches.delete(name)
    // The first install controls the open page at once, so it works offline
    // without a reload. Later versions only activate when the page asked.
    await worker.clients.claim()
  })())
})

worker.addEventListener('fetch', (event) => {
  const route = routeFor(event.request, worker.location.origin, PRECACHED)
  if (route.kind === 'bypass')
    return
  if (route.kind === 'network')
    return
  event.respondWith((async () => {
    // This version first, then the previous one's files for an old tab.
    const cached = await caches.match(route.key, { cacheName: CACHE }) ?? await caches.match(route.key)
    return cached ?? fetch(event.request)
  })())
})

worker.addEventListener('message', (event) => {
  // The page's "Reload" on the update prompt.
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING')
    void worker.skipWaiting()
})
