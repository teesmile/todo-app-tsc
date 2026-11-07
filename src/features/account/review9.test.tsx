import type { AccountClient } from './client'
import type { AccountUser } from './session'
import { createClient } from '@supabase/supabase-js'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from '@/features/tasks/components/appHeader'
import { AccountProvider } from './accountProvider'
import { accountClientFrom, AUTH_OPTIONS } from './client'

// Regression tests for the account findings of review 9.

const toni: AccountUser = { id: 'u-toni', email: 'toni@example.com', firstName: 'Toni', fullName: 'Toni Ugwuja' }
const ada: AccountUser = { id: 'u-ada', email: 'ada@example.com', firstName: 'Ada', fullName: 'Ada Lovelace' }

function setup(client: Partial<AccountClient>, user: AccountUser | null) {
  let listener: (u: AccountUser | null) => void = () => {}
  const full: AccountClient = {
    currentUser: async () => ({ user, error: null }),
    onChange: (cb) => {
      listener = cb
      return () => {}
    },
    signInWithGoogle: async () => null,
    signOut: async () => null,
    deleteAccount: vi.fn(async () => null),
    ...client,
  }
  const events = userEvent.setup()
  render(<AccountProvider configured load={async () => full}><AppHeader /></AccountProvider>)
  return { client: full, events, otherTab: (u: AccountUser | null) => act(() => listener(u)) }
}

afterEach(() => window.localStorage.clear())

describe('1: deleting is bound to the account that was confirmed', () => {
  it('drops the confirmation when another tab signs in as someone else', async () => {
    window.localStorage.setItem('sb-test-auth-token', '{}')
    const { client, events, otherTab } = setup({}, toni)
    await events.click(await screen.findByRole('button', { name: 'Account: Toni' }))
    await events.click(screen.getByRole('button', { name: 'Delete account…' }))
    expect(screen.getByRole('dialog', { name: 'Delete your account?' })).toHaveTextContent('toni@example.com')

    otherTab(ada)

    const dialog = screen.getByRole('dialog', { name: 'Your account' })
    expect(within(dialog).queryByRole('button', { name: 'Delete my account' })).not.toBeInTheDocument()
    expect(dialog).toHaveTextContent('ada@example.com')
    expect(client.deleteAccount).not.toHaveBeenCalled()
  })

  it('names the confirmed account in the delete call, for the server to check', async () => {
    window.localStorage.setItem('sb-test-auth-token', '{}')
    const { client, events } = setup({}, toni)
    await events.click(await screen.findByRole('button', { name: 'Account: Toni' }))
    await events.click(screen.getByRole('button', { name: 'Delete account…' }))
    await events.click(screen.getByRole('button', { name: 'Delete my account' }))
    expect(client.deleteAccount).toHaveBeenCalledExactlyOnceWith('u-toni')
  })
})

describe('3: a failed code exchange is reported, not hidden', () => {
  it('says sign-in didn\'t finish when the code couldn\'t be exchanged', async () => {
    window.history.replaceState(null, '', '/?code=expired')
    setup({ currentUser: async () => ({ user: null, error: 'invalid flow state, no valid flow state found' }) }, null)
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sign-in didn\'t finish: invalid flow state, no valid flow state found. Try signing in again.')
    expect(window.location.search).toBe('')
  })

  it('surfaces the real SDK\'s exchange error, which getSession alone hides', async () => {
    window.history.replaceState(null, '', '/?code=expired-code')
    window.localStorage.setItem('sb-test-auth-token-code-verifier', JSON.stringify('a-code-verifier'))
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
      JSON.stringify({ code: 404, error_code: 'flow_state_not_found', msg: 'invalid flow state, no valid flow state found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    ))
    const supabase = createClient('https://test.supabase.co', 'sb_publishable_test', { auth: AUTH_OPTIONS, global: { fetch } })

    const { user, error } = await accountClientFrom(supabase).currentUser()

    expect(fetch).toHaveBeenCalled()
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/auth/v1/token?grant_type=pkce')
    expect(user).toBeNull()
    expect(error).toMatch(/flow state/)
  })
})
