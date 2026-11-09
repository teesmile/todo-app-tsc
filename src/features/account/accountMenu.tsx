'use client'

import type { SignInMethod } from './config'
import type { AccountUser } from './session'
import type { SyncStatus } from '@/features/tasks/sync/useSync'
import { CloudAlert, CloudCheck, CloudOff, LogIn, RefreshCw, TriangleAlert, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { MAX_NAME_LENGTH } from '@/features/tasks/store/profile'
import { useAccount } from './accountContext'
import { SIGN_IN_METHODS } from './config'
import { GoogleIdentityButton, GoogleSignInButton } from './googleButton'

const SYNC_LABELS: Record<SyncStatus, string> = {
  'syncing': 'Syncing…',
  'synced': 'Synced',
  'offline': 'Offline',
  'unavailable': 'Sync paused',
  'signin-needed': 'Sign in again',
}

/**
 * The sync state beside the name: an icon, with words only when something
 * needs attention. The meaning is always in the tooltip and the button's
 * accessible name.
 */
const SYNC_ICONS: Record<SyncStatus, { Icon: typeof CloudCheck, words: string | null, tone: string }> = {
  'synced': { Icon: CloudCheck, words: null, tone: 'text-green-700' },
  'syncing': { Icon: RefreshCw, words: null, tone: 'text-gray-500 animate-spin motion-reduce:animate-none' },
  'offline': { Icon: CloudOff, words: 'Offline', tone: 'text-orange-800' },
  'unavailable': { Icon: CloudAlert, words: 'Sync paused', tone: 'text-orange-800' },
  'signin-needed': { Icon: TriangleAlert, words: 'Sign in again', tone: 'text-orange-800' },
}

const SYNC_EXPLAINED: Record<SyncStatus, string> = {
  'syncing': 'Syncing your tasks with your account.',
  'synced': 'Your tasks are synced with this account.',
  'offline': 'You\'re offline. Changes are saved on this device and sync when you\'re back online.',
  'unavailable': 'Your account can\'t be reached right now. Changes are saved on this device and sync when it\'s back.',
  'signin-needed': 'Your session has ended. Sign in again to sync; your changes are kept on this device until then.',
}

/** One native <dialog>, opened and closed from React state, that hands focus back when it closes. */
function useDialog(open: boolean, returnFocus?: React.RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLDialogElement>(null)
  const wasOpen = useRef(false)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog)
      return
    if (open && !dialog.open)
      dialog.showModal()
    else if (!open && dialog.open)
      dialog.close()
    if (wasOpen.current && !open)
      returnFocus?.current?.focus()
    wasOpen.current = open
  }, [open, returnFocus])
  return ref
}

const DIALOG_CLASS = 'fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl backdrop:bg-black/40 md:inset-0 md:m-auto md:h-fit md:max-w-md md:rounded-2xl'
const PRIMARY = 'min-h-11 rounded-lg bg-gray-900 px-4 font-medium text-white hover:bg-gray-700 disabled:opacity-60'
const SECONDARY = 'min-h-11 rounded-lg px-4 font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-60'

/**
 * The header's account control: "Sign in" for a guest; the account's name and
 * sync state when signed in; "Accounts unavailable" when Supabase can't be
 * reached. Each opens one native <dialog> (focus trap, Escape, inert page)
 * whose content follows the state. Renders nothing in a guest-only build.
 */
export function AccountMenu() {
  const { state, notice, sync, importOffer } = useAccount()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  if (state.status === 'off')
    return null

  const user = state.status === 'signed-in' ? state.user : null
  const syncLabel = user && sync ? SYNC_LABELS[sync] : null
  const name = user ? (user.firstName ?? user.email ?? 'Account') : null

  return (
    <div className="flex shrink-0 flex-col items-end">
      {user
        ? (
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              // The email is part of the name: two accounts can share a first
              // name, and the header alone couldn't tell them apart.
              aria-label={`Account: ${name}${user.email ? ` (${user.email})` : ''}${syncLabel ? `, ${syncLabel.replace('…', '')}` : ''}`}
              title={[user.email, syncLabel?.replace('…', '')].filter(Boolean).join(' · ') || undefined}
              className="flex min-h-11 max-w-[min(16rem,60vw)] items-center gap-2 rounded-full border border-gray-300 bg-white py-1 pl-1 pr-3 text-sm font-medium text-gray-800 hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            >
              {/* Fixed size, never shrinks: Safari lets a flex item in a tight row shrink to nothing. */}
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-900">
                {(name ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 truncate">{name}</span>
              {sync && (() => {
                const { Icon, words, tone } = SYNC_ICONS[sync]
                return (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-normal" data-sync={sync}>
                    <Icon size={16} strokeWidth={2.25} className={`shrink-0 ${tone}`} aria-hidden="true" />
                    {words && <span className="text-orange-800">{words}</span>}
                  </span>
                )
              })()}
            </button>
          )
        : (
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen(true)}
              disabled={state.status === 'checking'}
              aria-haspopup="dialog"
              className="flex min-h-11 items-center gap-2 rounded-full bg-gray-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:bg-gray-400"
            >
              <LogIn size={18} strokeWidth={2.25} className="shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap">{state.status === 'checking' ? 'Checking…' : state.status === 'unavailable' ? 'Accounts unavailable' : 'Sign in'}</span>
            </button>
          )}
      {/* Announces sign-in, sign-out and failures; also visible, in plain text. */}
      {/* Always mounted, so screen readers announce each notice; the text fades and is then cleared. */}
      <p role="status" className="mt-1 max-w-56 text-right text-xs text-gray-600">
        {notice && <span key={notice} className="notice-fade block">{notice}</span>}
      </p>
      <AccountDialog open={open} onClose={() => setOpen(false)} returnFocus={triggerRef} />
      <ImportDialog open={importOffer !== null} returnFocus={triggerRef} />
    </div>
  )
}

type View = { kind: 'main' } | { kind: 'confirm-delete', userId: string } | { kind: 'unsynced', userId: string, count: number }

function AccountDialog({ open, onClose, returnFocus }: { open: boolean, onClose: () => void, returnFocus: React.RefObject<HTMLButtonElement | null> }) {
  const account = useAccount()
  const { state, sync } = account
  const headingId = useId()
  const dialogRef = useDialog(open, returnFocus)
  const [view, setView] = useState<View>({ kind: 'main' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A confirmation belongs to the account it was opened for. If another tab
  // signs in as someone else, it disappears instead of pointing at them
  // (review 9).
  const signedInUser = state.status === 'signed-in' ? state.user : null
  const current: View = view.kind !== 'main' && view.userId !== signedInUser?.id ? { kind: 'main' } : view

  function close() {
    setView({ kind: 'main' })
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

  async function signOut(force: boolean) {
    setBusy(true)
    setError(null)
    const result = await account.signOut({ force })
    setBusy(false)
    if (result.kind === 'done')
      close()
    else if (result.kind === 'unsynced' && signedInUser)
      setView({ kind: 'unsynced', userId: signedInUser.id, count: result.count })
    else if (result.kind === 'error')
      setError(result.message)
  }

  const heading = current.kind === 'confirm-delete'
    ? 'Delete your account?'
    : current.kind === 'unsynced'
      ? 'Sign out with unsynced changes?'
      : signedInUser
        ? 'Your account'
        : state.status === 'unavailable'
          ? 'Accounts unavailable'
          : 'Sign in'

  const signInWith = (method: SignInMethod) => run(() => account.signIn(method), { closeOnSuccess: false })
  // Google's own button signs in without leaving the page. If its script
  // can't load, the redirect button takes over, so sign-in still works.
  const [googleFallback, setGoogleFallback] = useState(false)
  const signInButtons = (
    <div className="flex flex-col gap-2">
      {SIGN_IN_METHODS.map(method => (method === 'google'
        ? googleFallback
          ? <GoogleSignInButton key={method} onClick={() => signInWith(method)} disabled={busy} busy={busy} />
          : (
              <GoogleIdentityButton
                key={method}
                onCredential={(token, rawNonce) => void run(() => account.signInWithIdToken(token, rawNonce))}
                onUnavailable={() => setGoogleFallback(true)}
              />
            )
        : null))}
    </div>
  )

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget)
          close()
      }}
      className={DIALOG_CLASS}
    >
      {open && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id={headingId} className="text-lg font-semibold text-gray-900">{heading}</h2>
            <button type="button" onClick={close} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {signedInUser && current.kind === 'main' && (
            <div className="space-y-4 text-sm text-gray-700">
              <p>
                Signed in as
                {' '}
                <strong className="font-semibold text-gray-900">{signedInUser.fullName ?? signedInUser.email}</strong>
                {signedInUser.fullName && signedInUser.email && <span className="block text-gray-600">{signedInUser.email}</span>}
              </p>
              {/* Keyed by account: another tab signing in as someone else starts a fresh editor, so a draft can't be saved to them. */}
              <GreetingName key={signedInUser.id} user={signedInUser} onSaved={close} />
              {sync && <p className={`rounded-lg p-3 ${sync === 'synced' || sync === 'syncing' ? 'bg-gray-50 text-gray-800' : 'bg-orange-50 text-orange-900'}`}>{SYNC_EXPLAINED[sync]}</p>}
              {sync === 'signin-needed' && signInButtons}
              <div className="flex flex-wrap gap-2">
                {account.canImport && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      close()
                      account.openImport()
                    }}
                    className={SECONDARY}
                  >
                    Import tasks from this device
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => signOut(false)} className={PRIMARY}>
                  {busy ? 'Syncing…' : 'Sign out'}
                </button>
                <button type="button" disabled={busy} onClick={() => setView({ kind: 'confirm-delete', userId: signedInUser.id })} className="min-h-11 rounded-lg px-4 font-medium text-red-700 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-60">
                  Delete account…
                </button>
              </div>
            </div>
          )}

          {signedInUser && current.kind === 'unsynced' && (
            <div className="space-y-4 text-sm text-gray-700">
              <p>
                {`${current.count} change${current.count === 1 ? ' hasn\'t' : 's haven\'t'} synced yet. ${current.count === 1 ? 'It\'ll' : 'They\'ll'} stay on this device and sync next time you sign in.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => signOut(true)} className={PRIMARY}>Sign out anyway</button>
                <button type="button" disabled={busy} onClick={() => setView({ kind: 'main' })} className={SECONDARY}>Stay signed in</button>
              </div>
            </div>
          )}

          {signedInUser && current.kind === 'confirm-delete' && (
            <div className="space-y-4 text-sm text-gray-700">
              <p>
                This permanently deletes the account
                {' '}
                <strong className="font-semibold text-gray-900">{signedInUser.email ?? signedInUser.fullName}</strong>
                {' '}
                and everything stored with it, on our server and on this device. It can&apos;t be undone. Guest tasks on this device stay here.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => run(() => account.deleteAccount(signedInUser.id))} className="min-h-11 rounded-lg bg-red-700 px-4 font-medium text-white hover:bg-red-800 disabled:opacity-60">
                  {busy ? 'Deleting…' : 'Delete my account'}
                </button>
                <button type="button" disabled={busy} onClick={() => setView({ kind: 'main' })} className={SECONDARY}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(state.status === 'guest' || state.status === 'checking') && (
            <div className="space-y-4 text-sm text-gray-700">
              <p>
                You don&apos;t need an account: your tasks are saved on this device either way. Sign in to keep them in sync across your devices.
              </p>
              {signInButtons}
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
                className={PRIMARY}
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

/**
 * "Add N tasks from this device to your account": offered once per account
 * per device after signing in, and again from the account menu. Samples are
 * left out unless ticked; titles too long for the server stay on the device.
 */
function ImportDialog({ open, returnFocus }: { open: boolean, returnFocus: React.RefObject<HTMLButtonElement | null> }) {
  const { importOffer, answerImport, state } = useAccount()
  const signedIn = state.status === 'signed-in' ? state.user : null
  const headingId = useId()
  const dialogRef = useDialog(open, returnFocus)
  const [includeSamples, setIncludeSamples] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const samplesId = useId()

  const count = (importOffer?.own ?? 0) + (includeSamples ? importOffer?.samples ?? 0 : 0)

  async function answer(accept: boolean) {
    setBusy(true)
    setError(null)
    const failed = await answerImport(accept, includeSamples)
    setBusy(false)
    if (failed)
      setError(failed)
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      // Escape: keep them on this device, and don't ask again.
      onCancel={(e) => {
        e.preventDefault()
        void answer(false)
      }}
      // Closed any other way while still offered: the same answer.
      onClose={() => {
        if (importOffer)
          void answer(false)
      }}
      className={DIALOG_CLASS}
    >
      {open && importOffer && (
        <div className="space-y-4 text-sm text-gray-700">
          <h2 id={headingId} className="text-lg font-semibold text-gray-900">
            {`Add ${count} task${count === 1 ? '' : 's'} from this device to your account?`}
          </h2>
          <p>
            {'They\'ll be added to '}
            <strong className="font-semibold text-gray-900">{signedIn?.email ?? 'your account'}</strong>
            {' and sync to your other devices signed in to it. If you keep them here instead, you\'ll see them whenever you\'re signed out.'}
          </p>
          {importOffer.samples > 0 && (
            <div className="flex items-center gap-2">
              <input id={samplesId} type="checkbox" checked={includeSamples} onChange={e => setIncludeSamples(e.target.checked)} className="h-5 w-5 accent-orange-600" />
              <label htmlFor={samplesId}>{`Include the ${importOffer.samples} sample task${importOffer.samples === 1 ? '' : 's'}`}</label>
            </div>
          )}
          {importOffer.tooLong.length > 0 && (
            <div>
              <p className="font-medium text-gray-900">Too long to sync, so kept on this device:</p>
              <ul className="mt-1 list-disc pl-5">
                {importOffer.tooLong.map(title => <li key={title}>{`${title.slice(0, 60)}…`}</li>)}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || count === 0} onClick={() => answer(true)} className={PRIMARY}>Add to my account</button>
            <button type="button" disabled={busy} onClick={() => answer(false)} className={SECONDARY}>Keep them on this device</button>
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
        </div>
      )}
    </dialog>
  )
}

/**
 * The name the greeting uses for a signed-in user. Saved on the account (the
 * user's Supabase metadata), so every device shows it; empty goes back to the
 * Google name.
 */
function GreetingName({ user, onSaved }: { user: AccountUser, onSaved: () => void }) {
  const { setGreetingName } = useAccount()
  const [draft, setDraft] = useState<string | null>(null)
  // The latest typed text, readable after the save's await (the state above
  // is the value from when the save started).
  const latestDraft = useRef<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const value = draft ?? user.chosenName ?? user.googleName ?? ''

  async function save(name: string | null) {
    const submitted = draft
    setBusy(true)
    setError(null)
    const failed = await setGreetingName(name)
    setBusy(false)
    if (failed) {
      setError(failed)
      return
    }
    // Clear only what was submitted: text typed while the save was in flight
    // is a newer edit, not something to throw away (review 12).
    setDraft(current => (current === submitted ? null : current))
    // Done: close the dialog (focus goes back to the account button); the
    // header's notice says what the greeting now is. Text typed after
    // submitting keeps it open, so that newer text isn't lost (review 12).
    if (latestDraft.current === submitted) {
      latestDraft.current = null
      onSaved()
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save(value)
      }}
      className="space-y-2"
    >
      <label htmlFor={`${id}-name`} className="block font-medium text-gray-900">Name in the greeting</label>
      <div className="flex gap-2">
        <input
          id={`${id}-name`}
          type="text"
          autoComplete="given-name"
          value={value}
          maxLength={MAX_NAME_LENGTH}
          onChange={(e) => {
            latestDraft.current = e.target.value
            setDraft(e.target.value)
          }}
          aria-describedby={`${id}-hint`}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button type="submit" disabled={draft === null || busy} className={SECONDARY}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-gray-600">
        Saved to your account, so all your devices use it. Leave it empty to use your Google name.
        {user.chosenName && (
          <>
            {' '}
            <button type="button" disabled={busy} onClick={() => void save(null)} className="font-medium text-orange-800 underline">Use my Google name</button>
          </>
        )}
      </p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-800">{error}</p>}
    </form>
  )
}
