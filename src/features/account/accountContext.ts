'use client'

import type { SignInMethod } from './config'
import type { AccountUser } from './session'
import { createContext, use } from 'react'

export type AccountState
  /** Accounts aren't configured in this build: guest-only, no sign-in button. */
  = | { status: 'off' }
  /** Restoring a saved session or finishing a Google redirect. */
    | { status: 'checking' }
    | { status: 'guest' }
    | { status: 'signed-in', user: AccountUser }
  /** The SDK couldn't load or the session couldn't be restored (offline, paused project). */
    | { status: 'unavailable', message: string }

export interface Account {
  state: AccountState
  /** A one-off message for the header's live region: "Signed out", a failed sign-in. */
  notice: string | null
  /** Starts a sign-in. Resolves with an error message if it couldn't start (success navigates away). */
  signIn: (method: SignInMethod) => Promise<string | null>
  signOut: () => Promise<string | null>
  deleteAccount: () => Promise<string | null>
  /** Tries to restore the session again after 'unavailable'. */
  retry: () => void
}

const noop = async () => null

export const AccountContext = createContext<Account>({
  state: { status: 'off' },
  notice: null,
  signIn: noop,
  signOut: noop,
  deleteAccount: noop,
  retry: () => {},
})

export function useAccount(): Account {
  return use(AccountContext)
}
