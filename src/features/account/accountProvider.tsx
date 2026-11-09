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
import { accountNameKey } from '@/features/tasks/store/profile'
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
  // The state as of right now, for async callbacks that must check which
  // account is signed in before they write anything.
  const current = useRef<AccountState>(state)
  const [notice, setNotice] = useState<string | null>(null)
  const client = useRef<AccountClient | null>(null)
  const [remote, setRemote] = useState<Remote | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [importOffer, setImportOffer] = useState<ImportCandidates | null>(null)
  // Reads of the user (start-up, tab shown again) and name saves are
  // numbered: a read's answer only applies if nothing newer started since,
  // so a slow, older read can't put back a name the user just changed.
  const userOps = useRef(0)
  /** Every state change goes through here; a change of account invalidates reads in flight (review 13). */
  const setAccount = useCallback((next: AccountState) => {
    const before = current.current.status === 'signed-in' ? current.current.user.id : null
    const after = next.status === 'signed-in' ? next.user.id : null
    if (before !== after)
      userOps.current++
    current.current = next
    setState(next)
  }, [])
  /**
   * Applies a fresher copy of the signed-in user: only if it's still the
   * account signed in now and, for a read, nothing newer has started since.
   * Only then is it remembered for offline starts, so a late answer for
   * another account can't become the account this device restores.
   */
  const applyUser = useCallback((user: AccountUser, op?: number) => {
    if (op !== undefined && op !== userOps.current)
      return
    const now = current.current
    if (now.status !== 'signed-in' || now.user.id !== user.id)
      return
    rememberAccount(user)
    setAccount({ ...now, user })
  }, [setAccount])

  /**
   * Before names lived on the account, they were saved on the device
   * (accountNameKey). Called with a fresh read from Supabase, never the saved
   * session: the device name goes up only if the account has none, so it
   * can't overwrite a name chosen on another device (review 13). The
   * device copy is dropped either way.
   */
  const migrateDeviceName = useCallback(async (loaded: AccountClient, fresh: AccountUser) => {
    const local = (await getDb().meta.get(accountNameKey(fresh.id)))?.value
    if (typeof local !== 'string')
      return
    if (!fresh.chosenName) {
      const { user, error } = await loaded.setDisplayName(local)
      if (error)
        return
      if (user)
        applyUser(user)
    }
    await getDb().meta.delete(accountNameKey(fresh.id))
  }, [applyUser])

  const userId = state.status === 'signed-in' ? state.user.id : null
  const sync = useSync(userId, remote, { startOffline: state.status === 'signed-in' && Boolean(state.offline) })

  useEffect(() => {
    if (!configured)
      return
    let cancelled = false
    let unsubscribe = () => {}

    const signedIn = (user: AccountUser, offline = false) => {
      rememberAccount(user)
      setAccount({ status: 'signed-in', user, ...(offline ? { offline } : {}) })
    }
    /** Offline with a saved session: carry on as the remembered user. */
    const restoreOffline = () => {
      const remembered = mayHaveSession(storageKeys()) ? rememberedAccount() : null
      if (remembered)
        setAccount({ status: 'signed-in', user: remembered, offline: true })
      return remembered !== null
    }

    async function connect() {
      const search = window.location.search
      if (attempt === 0 && !isAuthCallback(search) && !mayHaveSession(storageKeys())) {
        setAccount({ status: 'guest' })
        return
      }
      try {
        const loaded = await load()
        if (cancelled)
          return
        client.current = loaded
        setRemote(loaded.remote)
        unsubscribe = loaded.onChange(user => (user ? signedIn(user) : setAccount({ status: 'guest' })))
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
            setNotice(`Signed in as ${[user.fullName, user.email && `(${user.email})`].filter(Boolean).join(' ') || 'you'}`)
          // The session holds the user as of sign-in; re-read it so a name
          // chosen on another device shows here too.
          const op = ++userOps.current
          void loaded.refreshUser().then(async (fresh) => {
            if (cancelled || !fresh || fresh.id !== user.id)
              return
            applyUser(fresh, op)
            await migrateDeviceName(loaded, fresh)
          })
        }
        else if (callback) {
          // Back from Google without a session: an error in the URL, or a
          // code that couldn't be exchanged (expired, reused, or from another
          // browser). Say so, rather than quietly showing a guest.
          setAccount({ status: 'guest' })
          setNotice(`Sign-in didn't finish: ${failed ?? error ?? 'Google didn\'t confirm it'}. Try signing in again.`)
        }
        else if (!error) {
          setAccount({ status: 'guest' })
        }
        else if (!restoreOffline()) {
          setAccount({ status: 'unavailable', message: UNREACHABLE })
        }
      }
      catch {
        if (!cancelled && !restoreOffline())
          setAccount({ status: 'unavailable', message: UNREACHABLE })
      }
    }

    void connect()
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [configured, load, attempt, applyUser, setAccount, migrateDeviceName])

  // Signed in offline: once the network is back, confirm the session for real.
  const offline = state.status === 'signed-in' && state.offline === true
  useEffect(() => {
    if (!offline)
      return
    const onOnline = () => setAttempt(n => n + 1)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [offline])

  // A greeting name chosen on another device arrives when this tab is looked at again.
  useEffect(() => {
    if (!userId)
      return
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !client.current)
        return
      const op = ++userOps.current
      void client.current.refreshUser().then((fresh) => {
        if (fresh?.id === userId)
          applyUser(fresh, op)
      })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, applyUser])

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
    setAccount({ status: 'guest' })
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
    setAccount({ status: 'guest' })
    setImportOffer(null)
    setNotice('Your account and everything stored with it were deleted. Guest tasks on this device are still here.')
    return null
  }, [])

  const retry = useCallback(() => {
    setAccount({ status: 'checking' })
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

  const setGreetingName = useCallback(async (name: string | null) => {
    const loaded = client.current
    if (!loaded || !userId)
      return UNREACHABLE
    // A save supersedes any read already in flight.
    ++userOps.current
    const { user, error } = await loaded.setDisplayName(name && name.trim() ? name.trim().slice(0, 40) : null)
    if (error)
      return `The name wasn't saved: ${error}`
    if (user)
      applyUser(user)
    return null
  }, [userId, applyUser])

  const canImport = Boolean(candidates && candidates.own + candidates.samples > 0)
  const value = useMemo<Account>(
    () => ({ state, notice, sync: userId ? sync.status : null, signIn, signOut, deleteAccount, retry, importOffer, canImport, openImport, answerImport, setGreetingName }),
    [state, notice, userId, sync.status, signIn, signOut, deleteAccount, retry, importOffer, canImport, openImport, answerImport, setGreetingName],
  )
  return <AccountContext value={value}>{children}</AccountContext>
}
