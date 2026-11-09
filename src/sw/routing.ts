/**
 * What the service worker does with one request. A pure function, so the
 * rules are unit-tested outside a worker.
 *
 * - `bypass`: let the browser handle it. Anything not a GET, and anything on
 *   another origin: Supabase (auth tokens and task rows must never sit in a
 *   cache, Phase 11) and Google's sign-in script.
 * - `precache`: answer from the files cached at install, by `key` (a path).
 * - `network`: same-origin, but not in the precache.
 */
export type Route = { kind: 'bypass' } | { kind: 'network' } | { kind: 'precache', key: string }

/** The exported HTML file for a page path: `/` → `/index.html`, `/privacy` → `/privacy.html`. */
export function pageFor(pathname: string): string {
  const path = pathname.replace(/\/+$/, '')
  if (path === '')
    return '/index.html'
  return path.endsWith('.html') ? path : `${path}.html`
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
      return { kind: 'precache', key: page }
    return precached.has('/404.html') ? { kind: 'precache', key: '/404.html' } : { kind: 'network' }
  }
  return precached.has(url.pathname) ? { kind: 'precache', key: url.pathname } : { kind: 'network' }
}
