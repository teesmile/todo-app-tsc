import type { Account } from './accountContext'
import type { AccountClient } from './client'
import { createClient } from '@supabase/supabase-js'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from '@/features/tasks/components/appHeader'
import { FakeAuth } from '@/test/fakeAuth'
import { useAccount } from './accountContext'
import { AccountProvider } from './accountProvider'
import { accountClientFrom, AUTH_OPTIONS } from './client'

// Regression tests for review 15.

const A = '88888888-8888-4888-8888-888888888888'
const B = '99999999-9999-4999-8999-999999999999'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('1: the name update is bound to the identity that was checked', () => {
  function signedInAs(userId: string, token: string) {
    const now = Math.floor(Date.now() / 1000)
    window.localStorage.setItem('sb-test-auth-token', JSON.stringify({
      access_token: token,
      refresh_token: 'r',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      user: { id: userId, aud: 'authenticated', email: `${userId.slice(0, 4)}@example.com`, user_metadata: {}, app_metadata: {} },
    }))
  }

  it('sends the update with the checked account\'s own token', async () => {
    signedInAs(A, 'token-for-A')
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ id: A, email: 'a@example.com', user_metadata: { display_name: 'Tony' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const supabase = createClient('https://test.supabase.co', 'sb_publishable_test', { auth: { ...AUTH_OPTIONS, detectSessionInUrl: false }, global: { fetch } })
    const client = accountClientFrom(supabase, { url: 'https://test.supabase.co', key: 'sb_publishable_test', fetch })

    const { user, error } = await client.setDisplayName('Tony', A)

    expect(error).toBeNull()
    expect(user?.chosenName).toBe('Tony')
    const put = fetch.mock.calls.find(([url, init]) => String(url).endsWith('/auth/v1/user') && init?.method === 'PUT')!
    expect(new Headers(put[1]!.headers).get('Authorization')).toBe('Bearer token-for-A')
  })

  it('refuses an answer for another account, so nothing is treated as saved', async () => {
    signedInAs(A, 'token-for-A')
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: B, user_metadata: { display_name: 'Tony' } }), { status: 200 }))
    const supabase = createClient('https://test.supabase.co', 'sb_publishable_test', { auth: { ...AUTH_OPTIONS, detectSessionInUrl: false }, global: { fetch } })
    const client = accountClientFrom(supabase, { url: 'https://test.supabase.co', key: 'sb_publishable_test', fetch })

    const { user, error } = await client.setDisplayName('Tony', A)
    expect(user).toBeNull()
    expect(error).toMatch(/no longer the account/)
  })

  it('refuses before sending when the session is already someone else\'s', async () => {
    signedInAs(B, 'token-for-B')
    const fetch = vi.fn()
    const supabase = createClient('https://test.supabase.co', 'sb_publishable_test', { auth: { ...AUTH_OPTIONS, detectSessionInUrl: false }, global: { fetch } })
    const client = accountClientFrom(supabase, { url: 'https://test.supabase.co', key: 'sb_publishable_test', fetch })

    expect((await client.setDisplayName('Tony', A)).error).toMatch(/no longer the account/)
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/auth/v1/user'))).toBe(false)
  })
})

describe('2: one Google sign-in at a time', () => {
  it('turns away a second ID token while the first exchange is still in flight', async () => {
    const auth = new FakeAuth()
    auth.addUser(A, 'a@example.com', 'Ada')
    let release!: () => void
    const firstDone = new Promise<void>(r => (release = r))
    const base = auth.client(A)
    const exchange = vi.fn(async (token: string, nonce: string) => {
      await firstDone
      return base.signInWithIdToken(token, nonce)
    })
    const client: AccountClient = { ...base, signInWithIdToken: exchange }
    let account!: Account
    function Probe() {
      account = useAccount()
      return null
    }
    render(<AccountProvider configured load={async () => client}><Probe /></AccountProvider>)

    let first!: Promise<string | null>
    let second!: string | null
    await act(async () => {
      first = account.signInWithIdToken('token-A', 'nonce-A')
      second = await account.signInWithIdToken('token-B', 'nonce-B')
    })
    expect(second).toBe('Already signing in. Wait a moment.')
    await act(async () => {
      release()
      expect(await first).toBeNull()
    })
    expect(exchange).toHaveBeenCalledOnce()
    expect(exchange).toHaveBeenCalledWith('token-A', 'nonce-A')
  })
})

describe('3: a stalled Google script still ends in a way to sign in', () => {
  it('shows the redirect button when the script neither loads nor fails', { timeout: 15_000 }, async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', '123-abc.apps.googleusercontent.com')
    // The request hangs: no load, no error.
    vi.spyOn(document.head, 'append').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<AccountProvider configured load={async () => new FakeAuth().client('none')}><AppHeader /></AccountProvider>)
    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    const fallback = await within(screen.getByRole('dialog', { name: 'Sign in' })).findByRole('button', { name: 'Continue with Google' }, { timeout: 9000 })
    expect(fallback).toHaveClass('gsi-button')
  })
})
