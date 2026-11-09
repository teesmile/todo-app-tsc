/** The address the app lives at: canonical URLs and the old-address banner point here. */
export const SITE_URL = 'https://todo.anthonyugwuja.dev'

/**
 * Addresses the app used to live at. They keep serving it, so local data
 * stored there (IndexedDB is per address) is never stranded; they show a
 * banner pointing to SITE_URL, and their pages' canonical URL is SITE_URL.
 */
export const OLD_HOSTS = ['todo-app-tsc-mauve.vercel.app']

/** The same page at the new address, or null when `location` is already there. */
export function movedTo(location: { hostname: string, pathname: string, search: string }): string | null {
  return OLD_HOSTS.includes(location.hostname) ? `${SITE_URL}${location.pathname}${location.search}` : null
}
