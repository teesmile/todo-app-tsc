import type { AccountUser } from './session'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'
import { accountUserFrom } from './session'

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
  /** Navigates to Google. Only returns if it couldn't start. */
  signInWithGoogle: (redirectTo: string) => Promise<string | null>
  /** Ends this device's session only; other devices stay signed in. */
  signOut: () => Promise<string | null>
  /** Deletes the account and, by cascade, everything stored with it. */
  deleteAccount: () => Promise<string | null>
}

let loading: Promise<AccountClient> | null = null

/**
 * Loads the Supabase SDK on first use, as its own chunk: a guest who never
 * opens sign-in never downloads it. PKCE is the OAuth flow for an app with no
 * server: the code Google sends back is useless without the verifier this
 * browser kept.
 */
export function loadAccountClient(): Promise<AccountClient> {
  loading ??= import('@supabase/supabase-js')
    .then(({ createClient }) => {
      const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
      })
      const client: AccountClient = {
        async currentUser() {
          const { data, error } = await supabase.auth.getSession()
          return { user: data.session ? accountUserFrom(data.session.user) : null, error: error?.message ?? null }
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
        async signOut() {
          const { error } = await supabase.auth.signOut({ scope: 'local' })
          return error?.message ?? null
        },
        async deleteAccount() {
          const { error } = await supabase.rpc('delete_my_account')
          return error?.message ?? null
        },
      }
      return client
    })
    .catch((error: unknown) => {
      // A failed chunk load (offline) mustn't stick: the next try loads again.
      loading = null
      throw error
    })
  return loading
}
