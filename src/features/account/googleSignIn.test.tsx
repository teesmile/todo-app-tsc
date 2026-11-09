import type { GoogleIdApi } from './googleIdentity'
import { createHash } from 'node:crypto'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from '@/features/tasks/components/appHeader'
import { FakeAuth } from '@/test/fakeAuth'
import { AccountProvider } from './accountProvider'

// Sign-in without leaving the page: Google Identity Services hands back an ID
// token in a popup, and Supabase signs in with it. The page never navigates.

const MAIN = '77777777-7777-4777-8777-777777777777'

function fakeGoogle() {
  const calls: { config?: Parameters<GoogleIdApi['initialize']>[0], button?: Parameters<GoogleIdApi['renderButton']>[1] } = {}
  const api: GoogleIdApi = {
    initialize: (config) => {
      calls.config = config
    },
    renderButton: (parent, options) => {
      calls.button = options
      const b = document.createElement('button')
      b.textContent = 'Continue with Google (Google\'s button)'
      parent.append(b)
    },
  }
  return { api, calls }
}

afterEach(() => {
  vi.unstubAllEnvs()
  delete window.google
  window.localStorage.clear()
})

describe('signing in with Google\'s own button', () => {
  it('signs in with the ID token and a nonce, without navigating, and closes the dialog', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', '123-abc.apps.googleusercontent.com')
    const google = fakeGoogle()
    window.google = { accounts: { id: google.api } }
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    const client = auth.client(MAIN)
    const signInWithIdToken = vi.spyOn(client, 'signInWithIdToken')
    const user = userEvent.setup()
    const before = { href: window.location.href, length: window.history.length }
    render(<AccountProvider configured load={async () => client}><AppHeader /></AccountProvider>)

    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    const dialog = screen.getByRole('dialog', { name: 'Sign in' })
    await within(dialog).findByRole('button', { name: /Google's button/ })
    expect(google.calls.config).toMatchObject({ client_id: '123-abc.apps.googleusercontent.com', ux_mode: 'popup' })
    expect(google.calls.button).toMatchObject({ text: 'continue_with', shape: 'pill', theme: 'outline' })

    // Google calls back with an ID token.
    google.calls.config!.callback({ credential: 'id-token-from-google' })

    await waitFor(() => expect(signInWithIdToken).toHaveBeenCalledOnce())
    const [token, rawNonce] = signInWithIdToken.mock.calls[0]
    expect(token).toBe('id-token-from-google')
    expect(createHash('sha256').update(rawNonce).digest('hex')).toBe(google.calls.config!.nonce)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: /^Account: Anthony/ })).toBeInTheDocument()
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Signed in as Anthony Ugwuja (anthony@example.com)')
    // No sign-in page entered this page's history.
    expect({ href: window.location.href, length: window.history.length }).toEqual(before)
  })

  it('falls back to the redirect button when Google\'s script can\'t load', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', '123-abc.apps.googleusercontent.com')
    const script = vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
      for (const node of nodes) {
        if (node instanceof HTMLScriptElement)
          queueMicrotask(() => node.onerror?.(new Event('error')))
      }
    })
    const user = userEvent.setup()
    render(<AccountProvider configured load={async () => new FakeAuth().client('none')}><AppHeader /></AccountProvider>)
    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    const fallback = await within(screen.getByRole('dialog', { name: 'Sign in' })).findByRole('button', { name: 'Continue with Google' })
    expect(fallback).toHaveClass('gsi-button')
    script.mockRestore()
  })

  it('falls back when Google refuses this site and draws an empty frame (an origin it hasn\'t approved, such as a preview URL)', { timeout: 15_000 }, async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', '123-abc.apps.googleusercontent.com')
    // What Google does for an origin not on the OAuth client: a zero-size frame and a console error, no exception.
    window.google = { accounts: { id: {
      initialize: () => {},
      renderButton: parent => parent.append(document.createElement('iframe')),
    } } }
    const user = userEvent.setup()
    render(<AccountProvider configured load={async () => new FakeAuth().client('none')}><AppHeader /></AccountProvider>)
    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    const fallback = await within(screen.getByRole('dialog', { name: 'Sign in' })).findByRole('button', { name: 'Continue with Google' }, { timeout: 8000 })
    expect(fallback).toHaveClass('gsi-button')
  })

  it('uses the redirect button when the build has no Google client ID', async () => {
    const user = userEvent.setup()
    render(<AccountProvider configured load={async () => new FakeAuth().client('none')}><AppHeader /></AccountProvider>)
    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(await within(screen.getByRole('dialog', { name: 'Sign in' })).findByRole('button', { name: 'Continue with Google' })).toHaveClass('gsi-button')
  })
})
