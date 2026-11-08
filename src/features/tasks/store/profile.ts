'use client'

import type { TasksDB } from './db'
import { useLiveQuery } from 'dexie-react-hooks'
import { getDb } from './db'

const NAME_KEY = 'displayName'
const PROMPT_DONE_KEY = 'namePromptDone'
export const MAX_NAME_LENGTH = 40

export interface Profile {
  /** The first name to greet, or null if none was given. */
  name: string | null
  /** True once the name prompt was answered or skipped, so it never shows again. */
  promptDone: boolean
}

/**
 * A guest's first name, kept on this device in the tasks database's meta
 * store. When accounts arrive (Phase 9), a signed-in user's name comes from
 * the account instead.
 */
export function useProfile(): Profile | undefined {
  return useLiveQuery(async () => {
    const db = getDb()
    const [name, done] = await Promise.all([db.meta.get(NAME_KEY), db.meta.get(PROMPT_DONE_KEY)])
    return { name: typeof name?.value === 'string' ? name.value : null, promptDone: Boolean(done?.value) }
  }, [])
}

/** Saves a trimmed first name (an empty one clears it) and marks the prompt answered. */
export async function setDisplayName(name: string, { db = getDb() }: { db?: TasksDB } = {}): Promise<void> {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH)
  await db.transaction('rw', db.meta, async () => {
    if (trimmed)
      await db.meta.put({ key: NAME_KEY, value: trimmed })
    else
      await db.meta.delete(NAME_KEY)
    await db.meta.put({ key: PROMPT_DONE_KEY, value: true })
  })
}

/** Skips the name prompt for good, without a name. */
export async function skipNamePrompt({ db = getDb() }: { db?: TasksDB } = {}): Promise<void> {
  await db.meta.put({ key: PROMPT_DONE_KEY, value: true })
}

/** The meta key for the name a signed-in user chose for the greeting, per account. */
export function accountNameKey(userId: string) {
  return `accountDisplayName:${userId}`
}

/**
 * The greeting name a signed-in user set on this device, or null to use the
 * account's own name. Undefined while loading.
 */
export function useAccountDisplayName(userId: string | null): string | null | undefined {
  return useLiveQuery(async () => {
    if (!userId)
      return null
    const entry = await getDb().meta.get(accountNameKey(userId))
    return typeof entry?.value === 'string' ? entry.value : null
  }, [userId])
}

/**
 * Sets the greeting name for a signed-in user on this device; it wins over
 * the account's name. An empty name clears it, so the account's name is
 * used again. Kept per account, so it survives signing out and back in, and
 * a guest's name is untouched.
 */
export async function setAccountDisplayName(userId: string, name: string, { db = getDb() }: { db?: TasksDB } = {}): Promise<string | null> {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH)
  if (trimmed)
    await db.meta.put({ key: accountNameKey(userId), value: trimmed })
  else
    await db.meta.delete(accountNameKey(userId))
  return trimmed || null
}
