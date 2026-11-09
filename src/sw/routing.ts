/**
 * What the service worker does with one request. Pure functions, so the
 * rules are unit-tested outside a worker.
 *
 * - `bypass`: let the browser handle it. Anything not a GET, and anything on
 *   another origin: Supabase (auth tokens and task rows must never sit in a
 *   cache, Phase 11) and Google's sign-in script.
 * - `cache`: answer from the app's caches by `key` (a URL path), falling
 *   back to the network.
 * - `network`: same-origin, but not something the worker keeps.
 *
 * Pages are cached under the URL a browser requests (`/privacy`), never the
 * exported filename (`/privacy.html`): Vercel serves the export with clean
 * URLs, so a `.html` request there can fail (review 18).
 */
export type Route = { kind: 'bypass' } | { kind: 'network' } | { kind: 'cache', key: string }

/** The page served for an unknown path. Vercel answers it with status 404. */
export const NOT_FOUND = '/404'

/** The clean URL for an exported file: `/index.html` → `/`, `/privacy.html` → `/privacy`; other files keep their path. */
export function urlForFile(path: string): string {
  if (!path.endsWith('.html'))
    return path
  const page = path.slice(0, -'.html'.length).replace(/(^|\/)index$/, '')
  return page === '' ? '/' : page
}

/** The cache key for a page path: trailing slashes and `.html` dropped. */
export function pageFor(pathname: string): string {
  return urlForFile(pathname.replace(/(.)\/+$/, '$1'))
}

/** Whether an install-time response may go in the cache: it must be OK, except the 404 page's own 404. */
export function acceptForPrecache(url: string, status: number): boolean {
  return (status >= 200 && status < 300) || (url === NOT_FOUND && status === 404)
}

export function routeFor(request: { url: string, method: string, mode: string }, origin: string, precached: ReadonlySet<string>): Route {
  if (request.method !== 'GET')
    return { kind: 'bypass' }
  const url = new URL(request.url)
  if (url.origin !== origin)
    return { kind: 'bypass' }
  if (request.mode === 'navigate') {
    // The app shell: the page's own HTML (its query, such as ?filter=, is
    // read by the page itself), else the 404 page, so offline navigation
    // never shows the browser's error page.
    const page = pageFor(url.pathname)
    if (precached.has(page))
      return { kind: 'cache', key: page }
    return precached.has(NOT_FOUND) ? { kind: 'cache', key: NOT_FOUND } : { kind: 'network' }
  }
  if (precached.has(url.pathname))
    return { kind: 'cache', key: url.pathname }
  // A hashed build file this version doesn't have: a tab still running the
  // previous version needs it, and the previous cache is kept for that.
  if (url.pathname.startsWith('/_next/static/'))
    return { kind: 'cache', key: url.pathname }
  return { kind: 'network' }
}
