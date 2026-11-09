'use client'

import type { SignInMethod } from './config'
import type { AccountUser } from './session'
import type { OwnerId } from '@/features/tasks/store/types'
import type { ImportCandidates } from '@/features/tasks/sync/account'
import type { SyncStatus } from '@/features/tasks/sync/useSync'
import { createContext, use } from 'react'
import { GUEST } from '@/features/tasks/store/types'

export type AccountState
  /** Accounts aren't configured in this build: guest-only, no sign-in button. */
  = | { status: 'off' }
  /** Restoring a saved session or finishing a Google redirect. */
    | { status: 'checking' }
    | { status: 'guest' }
  /** `offline`: restored from this device while Supabase can't be reached; changes queue until it can. */
    | { status: 'signed-in', user: AccountUser, offline?: boolean }
  /** The SDK couldn't load or the session couldn't be restored (offline, paused project). */
    | { status: 'unavailable', message: string }

export type SignOutResult
  = | { kind: 'done' }
  /** Changes the server doesn't have yet. Nothing was signed out: the user decides. */
    | { kind: 'unsynced', count: number }
    | { kind: 'error', message: string }

export interface Account {
  state: AccountState
  /** A one-off message for the header's live region: "Signed out", a failed sign-in. */
  notice: string | null
  /** Sync's state while signed in, null otherwise. */
  sync: SyncStatus | null
  /** Starts a sign-in. Resolves with an error message if it couldn't start (success navigates away). */
  signIn: (method: SignInMethod) => Promise<string | null>
  /** Signs in with the ID token from Google's own button (no navigation). Resolves with an error message, or null. */
  signInWithIdToken: (token: string, rawNonce: string) => Promise<string | null>
  /**
   * Pushes first. With changes still unsynced it stops and reports them,
   * unless `force`; then they stay on the device, hidden, for next time.
   */
  signOut: (options?: { force?: boolean }) => Promise<SignOutResult>
  /** Deletes the account the user confirmed; refused if it's no longer the signed-in one. */
  deleteAccount: (expectedUserId: string) => Promise<string | null>
  /** Tries to restore the session again after 'unavailable'. */
  retry: () => void
  /** The pending "add this device's tasks to your account" offer, or null. */
  importOffer: ImportCandidates | null
  /** Whether this device has guest tasks that could be added to the account. */
  canImport: boolean
  /** Shows the import offer again (from the account menu). */
  openImport: () => void
  /** Answers the offer. Resolves with an error message, or null. */
  answerImport: (accept: boolean, includeSamples: boolean) => Promise<string | null>
  /** Saves the greeting name on the account (null: back to the Google name). Resolves with an error message, or null. */
  setGreetingName: (name: string | null) => Promise<string | null>
}

const noop = async () => null

export const AccountContext = createContext<Account>({
  state: { status: 'off' },
  notice: null,
  sync: null,
  signIn: noop,
  signInWithIdToken: noop,
  signOut: async () => ({ kind: 'done' }),
  deleteAccount: noop,
  retry: () => {},
  importOffer: null,
  canImport: false,
  openImport: () => {},
  answerImport: noop,
  setGreetingName: noop,
})

export function useAccount(): Account {
  return use(AccountContext)
}

/**
 * Whose tasks the UI shows and writes: the signed-in user's, else the
 * guest's. Null while a saved session is being restored, so the guest's
 * tasks don't flash up first.
 */
export function useOwnerId(): OwnerId | null {
  const { state } = useAccount()
  if (state.status === 'checking')
    return null
  return state.status === 'signed-in' ? state.user.id : GUEST
}
