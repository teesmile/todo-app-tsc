import { ACTIVE_KEY, CACHE_PREFIX, cachesToDelete, META_CACHE } from './caches'
import { acceptForPrecache, routeFor } from './routing'

/**
 * The service worker (Phase 11), bundled into out/sw.js by
 * scripts/build-sw.mjs after `next build`, which also fills in the two
 * constants below from the exported files.
 *
 * - Install: precache every file the static export emits, so the app works
 *   offline from the first visit, including chunks never opened yet.
 * - Activate: keep this version's cache and the one that was active before
 *   it (tabs that haven't reloaded yet still need its files); delete the
 *   rest, failed installs included (caches.ts).
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
const CACHE = `${CACHE_PREFIX}${__VERSION__}`
const PRECACHED = new Set(__PRECACHE__)

worker.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    // One by one rather than addAll: the 404 page arrives with status 404.
    // Any other failure fails the install, so the old version stays in
    // charge. Every fetch settles first, then the half-filled cache is
    // deleted, so it can't be mistaken for a version later (review 19).
    const results = await Promise.allSettled(__PRECACHE__.map(async (url) => {
      // `reload`: a fresh copy, never one from the HTTP cache.
      const response = await fetch(new Request(url, { cache: 'reload' }))
      if (!acceptForPrecache(url, response.status))
        throw new Error(`precache: ${url} answered ${response.status}`)
      // A followed redirect can't answer a navigation, so store a plain copy.
      await cache.put(url, response.redirected ? new Response(response.body, response) : response)
    }))
    const failed = results.find(result => result.status === 'rejected')
    if (failed) {
      await caches.delete(CACHE)
      throw failed.reason
    }
  })())
})

worker.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Keep this version and the one that was active before it (see
    // caches.ts), then record this one as active.
    const meta = await caches.open(META_CACHE)
    const previous = await (await meta.match(ACTIVE_KEY))?.text() ?? null
    for (const name of cachesToDelete(await caches.keys(), CACHE, previous))
      await caches.delete(name)
    await meta.put(ACTIVE_KEY, new Response(CACHE))
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
