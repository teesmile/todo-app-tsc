import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountUser } from './session'
import type { Remote } from '@/features/tasks/sync/types'
import { supabaseRemote } from '@/features/tasks/sync/supabaseRemote'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'
import { accountUserFrom, DISPLAY_NAME_KEY } from './session'

/**
 * Everything the app does with Supabase Auth, as five methods. Components and
 * their tests depend on this, not on the SDK, so a test hands in a fake and
 * the real SDK is only ever loaded by `loadAccountClient`. Errors come back as
 * text (null on success) rather than thrown.
 */
export interface AccountClient {
  /** The saved session's user, restoring it (and finishing a Google redirect) first. */
  currentUser: () => Promise<{ user: AccountUser | null, error: string | null }>
  /** Calls back on sign-in, sign-out and token refresh. Returns an unsubscribe. */
  onChange: (callback: (user: AccountUser | null) => void) => () => void
  /** Navigates to Google. Only returns if it couldn't start. The fallback when Google's own button can't load. */
  signInWithGoogle: (redirectTo: string) => Promise<string | null>
  /**
   * Signs in with the ID token Google's own button returned, and the raw
   * nonce whose hash Google sealed into it. No navigation. Resolves with the
   * signed-in user or an error message.
   */
  signInWithIdToken: (token: string, rawNonce: string) => Promise<{ user: AccountUser | null, error: string | null }>
  /** Ends this device's session only; other devices stay signed in. */
  signOut: () => Promise<string | null>
  /**
   * Deletes the account and, by cascade, everything stored with it. The
   * server refuses unless `expectedUserId` is still the signed-in user.
   */
  deleteAccount: (expectedUserId: string) => Promise<string | null>
  /**
   * Sets (or, with null, clears) the greeting name on the account, in the
   * user's Supabase metadata, so every device gets it. Refuses unless this
   * browser's session is still `expectedUserId`: another tab may have
   * signed in as someone else (review 14). Returns the updated user or
   * an error message.
   */
  setDisplayName: (name: string | null, expectedUserId: string) => Promise<{ user: AccountUser | null, error: string | null }>
  /** Re-reads the user from Supabase Auth, to pick up a name changed on another device. */
  refreshUser: () => Promise<AccountUser | null>
  /** The server as the sync engine sees it, signed in as this session's user. */
  remote: Remote
}

let loading: Promise<AccountClient> | null = null

/**
 * Wraps a Supabase client in the AccountClient methods. Exported so a test
 * can run it against the real SDK with a mocked network.
 */
export function accountClientFrom(supabase: SupabaseClient): AccountClient {
  return {
    async currentUser() {
      // initialize() finishes a Google redirect's code exchange. Its error is
      // the only report of a failed exchange (an expired or reused code):
      // getSession() then just says "no session" (review 9).
      const { error: initError } = await supabase.auth.initialize()
      const { data, error } = await supabase.auth.getSession()
      return { user: data.session ? accountUserFrom(data.session.user) : null, error: (initError ?? error)?.message ?? null }
    },
    onChange(callback) {
      // Only state updates in here: calling other auth methods inside
      // this callback can deadlock the SDK's session lock.
      const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session ? accountUserFrom(session.user) : null))
      return () => data.subscription.unsubscribe()
    },
    async signInWithGoogle(redirectTo) {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
      return error?.message ?? null
    },
    async signInWithIdToken(token, rawNonce) {
      const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token, nonce: rawNonce })
      return { user: data.user ? accountUserFrom(data.user) : null, error: error?.message ?? null }
    },
    async signOut() {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) {
        // Offline, the SDK still removes this device's session but reports
        // the failed server call. Signed out is what matters here.
        const { data } = await supabase.auth.getSession()
        if (!data.session)
          return null
      }
      return error?.message ?? null
    },
    async deleteAccount(expectedUserId) {
      const { error } = await supabase.rpc('delete_my_account', { expected_user_id: expectedUserId })
      return error?.message ?? null
    },
    async setDisplayName(name, expectedUserId) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user.id !== expectedUserId)
        return { user: null, error: 'This is no longer the account the name was for' }
      const { data, error } = await supabase.auth.updateUser({ data: { [DISPLAY_NAME_KEY]: name } })
      return { user: data.user ? accountUserFrom(data.user) : null, error: error?.message ?? null }
    },
    async refreshUser() {
      const { data, error } = await supabase.auth.getUser()
      return error || !data.user ? null : accountUserFrom(data.user)
    },
    remote: supabaseRemote(supabase),
  }
}

/** The auth options: PKCE, a saved session, and the redirect read from the URL. */
export const AUTH_OPTIONS = { flowType: 'pkce', persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } as const

/**
 * Loads the Supabase SDK on first use, as its own chunk: a guest who never
 * opens sign-in never downloads it. PKCE is the OAuth flow for an app with no
 * server: the code Google sends back is useless without the verifier this
 * browser kept.
 */
export function loadAccountClient(): Promise<AccountClient> {
  loading ??= import('@supabase/supabase-js')
    .then(({ createClient }) => accountClientFrom(createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: AUTH_OPTIONS })))
    .catch((error: unknown) => {
      // A failed chunk load (offline) mustn't stick: the next try loads again.
      loading = null
      throw error
    })
  return loading
}
