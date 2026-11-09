import { routeFor } from './routing'

/**
 * The service worker (Phase 11), bundled into out/sw.js by
 * scripts/build-sw.mjs after `next build`, which also fills in the two
 * constants below from the exported files.
 *
 * - Install: precache every file the static export emits, so the app works
 *   offline from the first visit, including chunks never opened yet.
 * - Activate: delete earlier versions' caches.
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
    // `reload`: fetch fresh copies, never ones from the HTTP cache.
    await cache.addAll(__PRECACHE__.map(path => new Request(path, { cache: 'reload' })))
  })())
})

worker.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE)
        await caches.delete(name)
    }
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
    const cached = await caches.match(route.key, { cacheName: CACHE })
    return cached ?? fetch(event.request)
  })())
})

worker.addEventListener('message', (event) => {
  // The page's "Reload" on the update prompt.
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING')
    void worker.skipWaiting()
})
