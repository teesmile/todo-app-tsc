'use client'

import type { Account, AccountState } from './accountContext'
import type { AccountClient } from './client'
import type { SignInMethod } from './config'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountContext } from './accountContext'
import { loadAccountClient } from './client'
import { accountsConfigured } from './config'
import { callbackError, isAuthCallback, mayHaveSession, withoutAuthParams } from './session'

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
 * Owns the sign-in state. A guest with no saved session and no Google
 * redirect in the URL stays a guest without the SDK ever loading. Otherwise
 * the SDK loads, restores the session (finishing the redirect's code
 * exchange), and the sign-in parameters are removed from the URL while the
 * list's own parameters stay.
 *
 * Signing in or out never touches IndexedDB: tasks stay on the device either
 * way. Sync (Phase 10) is what will connect the two.
 */
export function AccountProvider({ children, configured = CONFIGURED, load = loadAccountClient }: AccountProviderProps) {
  const [state, setState] = useState<AccountState>(configured ? { status: 'checking' } : { status: 'off' })
  const [notice, setNotice] = useState<string | null>(null)
  const client = useRef<AccountClient | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!configured)
      return
    let cancelled = false
    let unsubscribe = () => {}

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
        unsubscribe = loaded.onChange(user => setState(user ? { status: 'signed-in', user } : { status: 'guest' }))
        const failed = callbackError(search)
        const { user, error } = await loaded.currentUser()
        const clean = withoutAuthParams(window.location.href)
        if (clean !== null)
          window.history.replaceState(window.history.state, '', clean)
        if (cancelled)
          return
        const callback = isAuthCallback(search)
        if (user) {
          setState({ status: 'signed-in', user })
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
        else {
          setState(error ? { status: 'unavailable', message: UNREACHABLE } : { status: 'guest' })
        }
      }
      catch {
        if (!cancelled)
          setState({ status: 'unavailable', message: UNREACHABLE })
      }
    }

    void connect()
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [configured, load, attempt])

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

  const signOut = useCallback(async () => {
    const loaded = client.current
    if (!loaded)
      return null
    const error = await loaded.signOut()
    if (error)
      return `Couldn't sign out: ${error}`
    setState({ status: 'guest' })
    setNotice('Signed out. Your tasks are still on this device.')
    return null
  }, [])

  const deleteAccount = useCallback(async (expectedUserId: string) => {
    const loaded = client.current
    if (!loaded)
      return UNREACHABLE
    const error = await loaded.deleteAccount(expectedUserId)
    if (error)
      return `Your account wasn't deleted: ${error}`
    // The user no longer exists, so this only clears the local session.
    await loaded.signOut()
    setState({ status: 'guest' })
    setNotice('Your account and everything stored with it were deleted. Tasks on this device are still here.')
    return null
  }, [])

  const retry = useCallback(() => {
    setState({ status: 'checking' })
    setAttempt(n => n + 1)
  }, [])

  const value = useMemo<Account>(
    () => ({ state, notice, signIn, signOut, deleteAccount, retry }),
    [state, notice, signIn, signOut, deleteAccount, retry],
  )
  return <AccountContext value={value}>{children}</AccountContext>
}
