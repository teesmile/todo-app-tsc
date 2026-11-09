/**
 * Which of the app's caches to keep when a new version activates (review
 * 19). A pure function, so the rule is unit-tested outside a worker.
 *
 * Kept: the new version's cache, and the cache of the version that was
 * active before it, because tabs still running that version load their
 * lazy chunks from it. Deleted: everything else, including a cache left
 * by an install that failed. The previous version is the one recorded at
 * its activation, never guessed from cache creation order: a failed
 * install creates a cache too.
 */
export const CACHE_PREFIX = 'todo-app-'
/** Holds the record of the active version. Its name doesn't start with CACHE_PREFIX, so cleanup never touches it. */
export const META_CACHE = 'todo-app:meta'
export const ACTIVE_KEY = '/active-version'

export function cachesToDelete(names: readonly string[], current: string, previous: string | null): string[] {
  const others = names.filter(name => name.startsWith(CACHE_PREFIX) && name !== current)
  // No record yet (a worker from before this was tracked): keep the newest
  // other cache, the best guess available.
  const keep = previous ?? others.at(-1)
  return others.filter(name => name !== keep)
}
