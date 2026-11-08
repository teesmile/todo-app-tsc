/**
 * Plain functions for the account layer, kept out of components so they're
 * unit-tested on their own.
 */

/** The query parameters Supabase puts on the URL when Google sends the user back. */
const AUTH_PARAMS = ['code', 'error', 'error_code', 'error_description'] as const

/**
 * Whether this browser may have a Supabase session: a saved session, or the
 * PKCE code verifier left by a sign-in that's still in flight. Guests with
 * neither never download the Supabase SDK.
 */
export function mayHaveSession(storageKeys: Iterable<string>): boolean {
  for (const key of storageKeys) {
    if (/^sb-.+-auth-token/.test(key))
      return true
  }
  return false
}

/** True when the URL is Google's redirect back, with a code or an error. */
export function isAuthCallback(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.has('code') || params.has('error_description')
}

/** Supabase's error text from a failed sign-in redirect, if any. */
export function callbackError(search: string): string | null {
  const params = new URLSearchParams(search)
  return params.get('error_description') ?? params.get('error')
}

/**
 * The URL with the sign-in parameters removed and everything else (the list's
 * filter, search and label) kept, or null if there was nothing to remove.
 */
export function withoutAuthParams(href: string): string | null {
  const url = new URL(href)
  if (!AUTH_PARAMS.some(name => url.searchParams.has(name)))
    return null
  for (const name of AUTH_PARAMS)
    url.searchParams.delete(name)
  return `${url.pathname}${url.search}${url.hash}`
}

/** What the app knows about a signed-in user. */
export interface AccountUser {
  id: string
  email: string | null
  firstName: string | null
  fullName: string | null
}

/** Maps a Supabase user (as stored in the session) to an AccountUser. */
export function accountUserFrom(user: { id: string, email?: string | null, user_metadata?: Record<string, unknown> }): AccountUser {
  const meta = user.user_metadata
  const full = typeof meta?.full_name === 'string' ? meta.full_name.trim() : typeof meta?.name === 'string' ? meta.name.trim() : ''
  return { id: user.id, email: user.email ?? null, firstName: firstNameFrom(meta), fullName: full || null }
}

const MAX_NAME_LENGTH = 40

/**
 * A first name to greet, from the account's Google profile: `given_name`, else
 * the first word of `full_name` or `name`. Null when the account has none.
 */
export function firstNameFrom(metadata: Record<string, unknown> | undefined): string | null {
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  const given = text(metadata?.given_name)
  const full = text(metadata?.full_name) || text(metadata?.name)
  const name = given || full.split(/\s+/)[0] || ''
  return name ? name.slice(0, MAX_NAME_LENGTH) : null
}

const REMEMBERED_KEY = 'todo:account'

/**
 * The last signed-in user, kept on this device so that opening the app
 * offline still shows their tasks: the saved Supabase session is still here,
 * but the SDK can't confirm it without the network. Only id, name and email.
 */
export function rememberAccount(user: AccountUser, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  try {
    storage.setItem(REMEMBERED_KEY, JSON.stringify(user))
  }
  catch {}
}

export function rememberedAccount(storage: Pick<Storage, 'getItem'> = window.localStorage): AccountUser | null {
  try {
    const value = JSON.parse(storage.getItem(REMEMBERED_KEY) ?? 'null') as AccountUser | null
    return value && typeof value.id === 'string' ? value : null
  }
  catch {
    return null
  }
}

export function forgetRememberedAccount(storage: Pick<Storage, 'removeItem'> = window.localStorage): void {
  try {
    storage.removeItem(REMEMBERED_KEY)
  }
  catch {}
}
