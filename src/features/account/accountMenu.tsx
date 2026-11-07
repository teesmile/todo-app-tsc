'use client'

import type { SignInMethod } from './config'
import { CircleUser, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { useAccount } from './accountContext'
import { SIGN_IN_METHODS } from './config'

const METHOD_LABELS: Record<SignInMethod, string> = {
  google: 'Continue with Google',
}

type View = 'main' | 'confirm-delete'

/**
 * The header's account control: "Sign in" for a guest, the account's name
 * when signed in, "Accounts unavailable" when Supabase can't be reached.
 * Each opens one native <dialog> (focus trap, Escape, inert page) whose
 * content follows the state. Renders nothing in a guest-only build.
 */
export function AccountMenu() {
  const { state, notice } = useAccount()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  if (state.status === 'off')
    return null

  const label = state.status === 'signed-in'
    ? (state.user.firstName ?? 'Account')
    : state.status === 'unavailable'
      ? 'Accounts unavailable'
      : 'Sign in'

  return (
    <div className="flex shrink-0 flex-col items-end">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        disabled={state.status === 'checking'}
        aria-haspopup="dialog"
        aria-label={state.status === 'signed-in' ? `Account: ${label}` : undefined}
        className="flex min-h-11 items-center gap-2 rounded-full border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-60"
      >
        <CircleUser className="h-5 w-5 text-gray-600" aria-hidden="true" />
        {state.status === 'checking' ? 'Checking…' : label}
      </button>
      {/* Announces sign-in, sign-out and failures; also visible, in plain text. */}
      <p role="status" className="mt-1 max-w-56 text-right text-xs text-gray-600 empty:hidden">{notice}</p>
      <AccountDialog open={open} onClose={() => setOpen(false)} returnFocus={triggerRef} />
    </div>
  )
}

function AccountDialog({ open, onClose, returnFocus }: { open: boolean, onClose: () => void, returnFocus: React.RefObject<HTMLButtonElement | null> }) {
  const account = useAccount()
  const { state } = account
  const headingId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [view, setView] = useState<View>('main')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog)
      return
    if (open && !dialog.open)
      dialog.showModal()
    else if (!open && dialog.open)
      dialog.close()
    if (wasOpen.current && !open)
      returnFocus.current?.focus()
    wasOpen.current = open
  }, [open, returnFocus])

  function close() {
    setView('main')
    setError(null)
    onClose()
  }

  async function run(action: () => Promise<string | null>, { closeOnSuccess = true } = {}) {
    setBusy(true)
    setError(null)
    const failed = await action()
    setBusy(false)
    if (failed)
      setError(failed)
    else if (closeOnSuccess)
      close()
  }

  const heading = view === 'confirm-delete'
    ? 'Delete your account?'
    : state.status === 'signed-in'
      ? 'Your account'
      : state.status === 'unavailable'
        ? 'Accounts unavailable'
        : 'Sign in'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget)
          close()
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl backdrop:bg-black/40 md:inset-0 md:m-auto md:h-fit md:max-w-md md:rounded-2xl"
    >
      {open && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id={headingId} className="text-lg font-semibold text-gray-900">{heading}</h2>
            <button type="button" onClick={close} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {state.status === 'signed-in' && view === 'main' && (
            <div className="space-y-4 text-sm text-gray-700">
              <p>
                Signed in as
                {' '}
                <strong className="font-semibold text-gray-900">{state.user.fullName ?? state.user.email}</strong>
                {state.user.fullName && state.user.email && <span className="block text-gray-600">{state.user.email}</span>}
              </p>
              <p className="rounded-lg bg-orange-50 p-3 text-orange-900">
                Sync is coming in the next update. For now your tasks stay on this device and aren&apos;t copied to your account.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => run(account.signOut)} className="min-h-11 rounded-lg bg-gray-900 px-4 font-medium text-white hover:bg-gray-700 disabled:opacity-60">
                  Sign out
                </button>
                <button type="button" disabled={busy} onClick={() => setView('confirm-delete')} className="min-h-11 rounded-lg px-4 font-medium text-red-700 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-60">
                  Delete account…
                </button>
              </div>
            </div>
          )}

          {state.status === 'signed-in' && view === 'confirm-delete' && (
            <div className="space-y-4 text-sm text-gray-700">
              <p>
                This permanently deletes your account and everything stored with it on our server. It can&apos;t be undone.
                Tasks on this device stay here.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => run(account.deleteAccount)} className="min-h-11 rounded-lg bg-red-700 px-4 font-medium text-white hover:bg-red-800 disabled:opacity-60">
                  {busy ? 'Deleting…' : 'Delete my account'}
                </button>
                <button type="button" disabled={busy} onClick={() => setView('main')} className="min-h-11 rounded-lg px-4 font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(state.status === 'guest' || state.status === 'checking') && (
            <div className="space-y-4 text-sm text-gray-700">
              <p>
                You don&apos;t need an account: your tasks are saved on this device either way. Signing in will let them sync between your devices once sync arrives.
              </p>
              <div className="flex flex-col gap-2">
                {SIGN_IN_METHODS.map(method => (
                  <button
                    key={method}
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => account.signIn(method), { closeOnSuccess: false })}
                    className="min-h-11 rounded-lg bg-gray-900 px-4 font-medium text-white hover:bg-gray-700 disabled:opacity-60"
                  >
                    {busy ? 'Opening Google…' : METHOD_LABELS[method]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600">
                Google shares your name, email address and profile picture with this app. See the
                {' '}
                <Link href="/privacy" className="font-medium text-orange-800 underline">privacy policy</Link>
                {' '}
                and
                {' '}
                <Link href="/terms" className="font-medium text-orange-800 underline">terms</Link>
                .
              </p>
            </div>
          )}

          {state.status === 'unavailable' && (
            <div className="space-y-4 text-sm text-gray-700">
              <p>{state.message}</p>
              <button
                type="button"
                onClick={() => {
                  account.retry()
                  close()
                }}
                className="min-h-11 rounded-lg bg-gray-900 px-4 font-medium text-white hover:bg-gray-700"
              >
                Try again
              </button>
            </div>
          )}

          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        </div>
      )}
    </dialog>
  )
}
