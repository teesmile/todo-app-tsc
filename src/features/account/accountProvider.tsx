'use client'

import type { Account, AccountState, SignOutResult } from './accountContext'
import type { AccountClient } from './client'
import type { SignInMethod } from './config'
import type { AccountUser } from './session'
import type { ImportCandidates } from '@/features/tasks/sync/account'
import type { Remote } from '@/features/tasks/sync/types'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDb } from '@/features/tasks/store/db'
import { declineImport, evictSignedOutUser, forgetUser, importCandidates, importGuestTasks, importOfferedKey, unsyncedCount } from '@/features/tasks/sync/account'
import { pushAll } from '@/features/tasks/sync/engine'
import { useSync } from '@/features/tasks/sync/useSync'
import { AccountContext } from './accountContext'
import { loadAccountClient } from './client'
import { accountsConfigured } from './config'
import { callbackError, forgetRememberedAccount, isAuthCallback, mayHaveSession, rememberAccount, rememberedAccount, withoutAuthParams } from './session'

const CONFIGURED = accountsConfigured()
const UNREACHABLE = 'Accounts can\'t be reached right now. Your tasks are safe on this device.'

function storageKeys(): string[] {
  try {
    return Object.keys(window.localStorage)
  }
  catch {
    // Storage blocked (some private windows): there can't be a saved session.
    return []
  }
}

interface AccountProviderProps {
  children: React.ReactNode
  /** Injected by tests; the app uses the build's env variables and the real SDK. */
  configured?: boolean
  load?: () => Promise<AccountClient>
}

/**
 * Owns the sign-in state and runs sync while someone is signed in.
 *
 * A guest with no saved session and no Google redirect in the URL stays a
 * guest without the SDK ever loading. Otherwise the SDK loads, restores the
 * session (finishing the redirect's code exchange), and the sign-in
 * parameters are removed from the URL. Opened offline with a saved session,
 * the remembered user stays signed in and changes queue until Supabase can
 * be reached.
 */
export function AccountProvider({ children, configured = CONFIGURED, load = loadAccountClient }: AccountProviderProps) {
  const [state, setState] = useState<AccountState>(configured ? { status: 'checking' } : { status: 'off' })
  const [notice, setNotice] = useState<string | null>(null)
  const client = useRef<AccountClient | null>(null)
  const [remote, setRemote] = useState<Remote | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [importOffer, setImportOffer] = useState<ImportCandidates | null>(null)

  const userId = state.status === 'signed-in' ? state.user.id : null
  const sync = useSync(userId, remote, { startOffline: state.status === 'signed-in' && Boolean(state.offline) })

  useEffect(() => {
    if (!configured)
      return
    let cancelled = false
    let unsubscribe = () => {}

    const signedIn = (user: AccountUser, offline = false) => {
      rememberAccount(user)
      setState({ status: 'signed-in', user, ...(offline ? { offline } : {}) })
    }
    /** Offline with a saved session: carry on as the remembered user. */
    const restoreOffline = () => {
      const remembered = mayHaveSession(storageKeys()) ? rememberedAccount() : null
      if (remembered)
        setState({ status: 'signed-in', user: remembered, offline: true })
      return remembered !== null
    }

    async function connect() {
      const search = window.location.search
      if (attempt === 0 && !isAuthCallback(search) && !mayHaveSession(storageKeys())) {
        setState({ status: 'guest' })
        return
      }
      try {
        const loaded = await load()
        if (cancelled)
          return
        client.current = loaded
        setRemote(loaded.remote)
        unsubscribe = loaded.onChange(user => (user ? signedIn(user) : setState({ status: 'guest' })))
        const failed = callbackError(search)
        const { user, error } = await loaded.currentUser()
        const clean = withoutAuthParams(window.location.href)
        if (clean !== null)
          window.history.replaceState(window.history.state, '', clean)
        if (cancelled)
          return
        const callback = isAuthCallback(search)
        if (user) {
          signedIn(user)
          if (callback)
            setNotice(`Signed in as ${user.fullName ?? user.email ?? 'you'}`)
        }
        else if (callback) {
          // Back from Google without a session: an error in the URL, or a
          // code that couldn't be exchanged (expired, reused, or from another
          // browser). Say so, rather than quietly showing a guest.
          setState({ status: 'guest' })
          setNotice(`Sign-in didn't finish: ${failed ?? error ?? 'Google didn\'t confirm it'}. Try signing in again.`)
        }
        else if (!error) {
          setState({ status: 'guest' })
        }
        else if (!restoreOffline()) {
          setState({ status: 'unavailable', message: UNREACHABLE })
        }
      }
      catch {
        if (!cancelled && !restoreOffline())
          setState({ status: 'unavailable', message: UNREACHABLE })
      }
    }

    void connect()
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [configured, load, attempt])

  // Signed in offline: once the network is back, confirm the session for real.
  const offline = state.status === 'signed-in' && state.offline === true
  useEffect(() => {
    if (!offline)
      return
    const onOnline = () => setAttempt(n => n + 1)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [offline])

  // The first-sign-in offer: once per account per device, when this device
  // has guest tasks of its own (samples alone don't prompt).
  const candidates = useLiveQuery(() => (userId ? importCandidates() : undefined), [userId])
  useEffect(() => {
    if (!userId || !candidates || candidates.own === 0)
      return
    let cancelled = false
    void getDb().meta.get(importOfferedKey(userId)).then((answered) => {
      if (!cancelled && !answered)
        setImportOffer(candidates)
    })
    return () => {
      cancelled = true
    }
  }, [userId, candidates])

  const ensureClient = useCallback(async () => {
    client.current ??= await load()
    return client.current
  }, [load])

  const signIn = useCallback(async (method: SignInMethod) => {
    try {
      const loaded = await ensureClient()
      // Back to this page (filters kept), which must match a redirect URL
      // allowed in supabase/config.toml.
      const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.search}`
      if (method === 'google')
        return await loaded.signInWithGoogle(redirectTo)
      return null
    }
    catch {
      return UNREACHABLE
    }
  }, [ensureClient])

  const signOut = useCallback(async ({ force = false } = {}): Promise<SignOutResult> => {
    const loaded = client.current
    if (!userId)
      return { kind: 'done' }
    if (!force) {
      try {
        if (loaded)
          await pushAll({ db: getDb(), remote: loaded.remote, userId })
      }
      catch {
        // Offline or unavailable: what's left is counted below.
      }
      const count = await unsyncedCount(userId)
      if (count > 0)
        return { kind: 'unsynced', count }
    }
    if (loaded) {
      const error = await loaded.signOut()
      if (error)
        return { kind: 'error', message: `Couldn't sign out: ${error}` }
    }
    const kept = await evictSignedOutUser(userId)
    forgetRememberedAccount()
    setState({ status: 'guest' })
    setImportOffer(null)
    setNotice(kept > 0
      ? `Signed out. ${kept} unsynced change${kept === 1 ? ' stays' : 's stay'} on this device and will sync next time you sign in.`
      : 'Signed out. Your account\'s tasks were removed from this device; guest tasks are still here.')
    return { kind: 'done' }
  }, [userId])

  const deleteAccount = useCallback(async (expectedUserId: string) => {
    const loaded = client.current
    if (!loaded)
      return UNREACHABLE
    const error = await loaded.deleteAccount(expectedUserId)
    if (error)
      return `Your account wasn't deleted: ${error}`
    // The user no longer exists, so this only clears the local session; the
    // account's rows can never sync again, so they leave this device too.
    await loaded.signOut()
    await forgetUser(expectedUserId)
    forgetRememberedAccount()
    setState({ status: 'guest' })
    setImportOffer(null)
    setNotice('Your account and everything stored with it were deleted. Guest tasks on this device are still here.')
    return null
  }, [])

  const retry = useCallback(() => {
    setState({ status: 'checking' })
    setAttempt(n => n + 1)
  }, [])

  const openImport = useCallback(() => {
    void importCandidates().then(setImportOffer)
  }, [])

  const syncNow = sync.syncNow
  const answerImport = useCallback(async (accept: boolean, includeSamples: boolean) => {
    if (!userId)
      return null
    try {
      if (accept) {
        const added = await importGuestTasks(userId, { includeSamples })
        setNotice(`Added ${added} task${added === 1 ? '' : 's'} from this device to your account.`)
        void syncNow()
      }
      else {
        await declineImport(userId)
      }
      setImportOffer(null)
      return null
    }
    catch {
      return 'That couldn\'t be saved. Try again.'
    }
  }, [userId, syncNow])

  const canImport = Boolean(candidates && candidates.own + candidates.samples > 0)
  const value = useMemo<Account>(
    () => ({ state, notice, sync: userId ? sync.status : null, signIn, signOut, deleteAccount, retry, importOffer, canImport, openImport, answerImport }),
    [state, notice, userId, sync.status, signIn, signOut, deleteAccount, retry, importOffer, canImport, openImport, answerImport],
  )
  return <AccountContext value={value}>{children}</AccountContext>
}
