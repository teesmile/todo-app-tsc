import type { AccountClient } from './client'
import type { AccountUser } from './session'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from '@/features/tasks/components/appHeader'
import { getDb } from '@/features/tasks/store/db'
import { setDisplayName } from '@/features/tasks/store/profile'
import { add } from '@/features/tasks/store/repository'
import { FakeRemote } from '@/test/fakeRemote'
import { AccountProvider } from './accountProvider'

const toni: AccountUser = { id: 'u1', email: 'toni@example.com', firstName: 'Toni', fullName: 'Toni Ugwuja' }

function fakeClient(overrides: Partial<AccountClient> = {}, user: AccountUser | null = null) {
  let listener: (u: AccountUser | null) => void = () => {}
  const client = {
    currentUser: vi.fn(async () => ({ user, error: null })),
    onChange: vi.fn((cb: (u: AccountUser | null) => void) => {
      listener = cb
      return () => {}
    }),
    signInWithGoogle: vi.fn(async () => null),
    signOut: vi.fn(async () => {
      listener(null)
      return null
    }),
    deleteAccount: vi.fn(async () => null),
    remote: new FakeRemote(),
    ...overrides,
  } satisfies AccountClient
  return client
}

function renderHeader(client: AccountClient | Error, { configured = true } = {}) {
  const load = vi.fn(() => (client instanceof Error ? Promise.reject(client) : Promise.resolve(client)))
  const user = userEvent.setup()
  render(
    <AccountProvider configured={configured} load={load}>
      <AppHeader />
    </AccountProvider>,
  )
  return { load, user }
}

describe('account menu', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('renders nothing to sign in with when the build has no Supabase variables', async () => {
    renderHeader(fakeClient(), { configured: false })
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument()
  })

  it('keeps a guest a guest without loading the SDK, and offers Google only', async () => {
    window.history.replaceState(null, '', '/?filter=overdue')
    const client = fakeClient()
    const { load, user } = renderHeader(client)

    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(load).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog', { name: 'Sign in' })
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '/privacy')
    expect(within(dialog).getByRole('link', { name: 'terms' })).toHaveAttribute('href', '/terms')

    await user.click(within(dialog).getByRole('button', { name: 'Continue with Google' }))
    // Back to the same page with the list's view kept, after Google.
    expect(client.signInWithGoogle).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/?filter=overdue`)
  })

  it('finishes the redirect from Google: greets by the account name and tidies the URL', async () => {
    window.history.replaceState(null, '', '/?filter=overdue&code=abc123')
    const client = fakeClient({}, toni)
    const { load } = renderHeader(client)

    expect(await screen.findByRole('button', { name: /^Account: Toni/ })).toBeInTheDocument()
    expect(load).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('Signed in as Toni Ugwuja')
    expect(window.location.search).toBe('?filter=overdue')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Toni$/))
    expect(screen.queryByLabelText(/what should we call you/i)).not.toBeInTheDocument()
  })

  it('restores a saved session on a later visit', async () => {
    window.localStorage.setItem('sb-test-auth-token', '{}')
    renderHeader(fakeClient({}, toni))
    expect(await screen.findByRole('button', { name: /^Account: Toni/ })).toBeInTheDocument()
  })

  it('says so when the redirect comes back with an error, and stays a guest', async () => {
    window.history.replaceState(null, '', '/?error=access_denied&error_description=Access+denied')
    renderHeader(fakeClient())
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sign-in didn\'t finish: Access denied')
    expect(window.location.search).toBe('')
  })

  it('shows Accounts unavailable when Supabase can\'t be loaded, and can try again', async () => {
    window.localStorage.setItem('sb-test-auth-token', '{}')
    const { load, user } = renderHeader(new Error('offline'))
    await user.click(await screen.findByRole('button', { name: 'Accounts unavailable' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Your tasks are safe on this device')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  })

  it('signs out from the account dialog, keeps the device name, and puts focus back', async () => {
    window.localStorage.setItem('sb-test-auth-token', '{}')
    await setDisplayName('Tee')
    const client = fakeClient({}, toni)
    const { user } = renderHeader(client)

    await user.click(await screen.findByRole('button', { name: /^Account: Toni/ }))
    const dialog = screen.getByRole('dialog', { name: 'Your account' })
    expect(dialog).toHaveTextContent('toni@example.com')
    expect(dialog).toHaveTextContent('Your tasks are synced with your account')
    await user.click(within(dialog).getByRole('button', { name: 'Sign out' }))

    const signIn = await screen.findByRole('button', { name: 'Sign in' })
    expect(client.signOut).toHaveBeenCalledOnce()
    // Focus returns when the dialog closes, once sign-out has finished.
    await waitFor(() => expect(signIn).toHaveFocus())
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Signed out'))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Tee$/))
  })

  it('deletes the account only after a confirmation', async () => {
    window.localStorage.setItem('sb-test-auth-token', '{}')
    const client = fakeClient({}, toni)
    const { user } = renderHeader(client)

    await user.click(await screen.findByRole('button', { name: /^Account: Toni/ }))
    await user.click(screen.getByRole('button', { name: 'Delete account…' }))
    expect(screen.getByRole('dialog', { name: 'Delete your account?' })).toHaveTextContent('can\'t be undone')
    expect(client.deleteAccount).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete my account' }))
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(client.deleteAccount).toHaveBeenCalledExactlyOnceWith('u1')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Your account and everything stored with it were deleted'))
  })

  it('keeps the account and says why when deleting fails', async () => {
    window.localStorage.setItem('sb-test-auth-token', '{}')
    const client = fakeClient({ deleteAccount: vi.fn(async () => 'network error') }, toni)
    const { user } = renderHeader(client)

    await user.click(await screen.findByRole('button', { name: /^Account: Toni/ }))
    await user.click(screen.getByRole('button', { name: 'Delete account…' }))
    await user.click(screen.getByRole('button', { name: 'Delete my account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your account wasn\'t deleted: network error')
    expect(client.signOut).not.toHaveBeenCalled()
  })

  it('never touches the tasks on the device when signing in or out', async () => {
    window.localStorage.setItem('sb-test-auth-token', '{}')
    await add({ title: 'Mine, on this device' })
    const before = await getDb().tasks.toArray()
    const { user } = renderHeader(fakeClient({}, toni))

    await user.click(await screen.findByRole('button', { name: /^Account: Toni/ }))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('button', { name: 'Sign in' })

    expect(await getDb().tasks.toArray()).toEqual(before)
  })
})
