import type { AccountClient } from './client'
import type { AccountUser } from './session'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AppHeader } from '@/features/tasks/components/appHeader'
import { getDb } from '@/features/tasks/store/db'
import { accountNameKey, setAccountDisplayName, setDisplayName } from '@/features/tasks/store/profile'
import { forgetUser } from '@/features/tasks/sync/account'
import { FakeRemote } from '@/test/fakeRemote'
import { AccountProvider } from './accountProvider'
import { GoogleSignInButton } from './googleButton'

// The sign-in polish from the phone test: the account icon, Google's own
// button, and a greeting name a signed-in user can edit.

const toni: AccountUser = { id: '44444444-4444-4444-8444-444444444444', email: 'toni@example.com', firstName: 'Toni', fullName: 'Toni Ugwuja' }

function client(user: AccountUser | null): AccountClient {
  return {
    currentUser: async () => ({ user, error: null }),
    onChange: () => () => {},
    signInWithGoogle: async () => null,
    signOut: async () => null,
    deleteAccount: async () => null,
    remote: new FakeRemote(),
  }
}

function renderHeader(user: AccountUser | null) {
  if (user)
    window.localStorage.setItem('sb-test-auth-token', '{}')
  const events = userEvent.setup()
  const view = render(<AccountProvider configured load={async () => client(user)}><AppHeader /></AccountProvider>)
  return { events, ...view }
}

afterEach(() => window.localStorage.clear())

describe('the account icon', () => {
  it.each([['a guest', null, 'Sign in'], ['a signed-in user', toni, /^Account: Toni/]] as const)('is a fixed 20px icon that never shrinks, for %s', async (_who, user, name) => {
    renderHeader(user)
    const trigger = await screen.findByRole('button', { name })
    const icon = trigger.querySelector('svg')!
    expect(icon).toHaveAttribute('width', '20')
    expect(icon).toHaveAttribute('height', '20')
    expect(icon).toHaveClass('shrink-0')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('the official Google sign-in button', () => {
  it('is a real button named "Continue with Google", with Google\'s own G as decoration', () => {
    render(<GoogleSignInButton onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'Continue with Google' })
    expect(button).toHaveClass('gsi-button')
    const logo = button.querySelector('img')!
    expect(logo.getAttribute('src')).toContain('/google-g.svg')
    expect(logo).toHaveAttribute('alt', '')
    expect(logo).toHaveAttribute('width', '20')
  })

  it('says it\'s opening Google and can\'t be pressed twice while busy', () => {
    render(<GoogleSignInButton onClick={() => {}} busy disabled />)
    expect(screen.getByRole('button', { name: 'Opening Google…' })).toBeDisabled()
  })

  it('replaces the plain button in the sign-in dialog', async () => {
    const { events } = renderHeader(null)
    await events.click(await screen.findByRole('button', { name: 'Sign in' }))
    const dialog = screen.getByRole('dialog', { name: 'Sign in' })
    expect(within(dialog).getByRole('button', { name: 'Continue with Google' })).toHaveClass('gsi-button')
  })
})

describe('the greeting name for a signed-in user', () => {
  it('can be edited from the account menu, wins over the account name, and stays on the device', async () => {
    await setDisplayName('Guest name')
    const { events, unmount } = renderHeader(toni)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Toni$/))

    await events.click(screen.getByRole('button', { name: /^Account: Toni/ }))
    const field = screen.getByRole('textbox', { name: 'Name in the greeting' })
    expect(field).toHaveValue('Toni')
    await events.clear(field)
    await events.type(field, 'Tee{Enter}')

    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Tee$/))
    expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('The greeting now says "Tee".')

    // A reload: still Tee, from this device.
    unmount()
    renderHeader(toni)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Tee$/))
    // The guest's own name is untouched.
    expect((await getDb().meta.get('displayName'))?.value).toBe('Guest name')
  })

  it('goes back to the account\'s name with "Use my Google name"', async () => {
    await setAccountDisplayName(toni.id, 'Tee')
    const { events } = renderHeader(toni)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Tee$/))
    await events.click(screen.getByRole('button', { name: /^Account: Toni/ }))
    // It appears once the saved name has loaded from the device.
    await events.click(await screen.findByRole('button', { name: 'Use my Google name' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Toni$/))
    expect(await getDb().meta.get(accountNameKey(toni.id))).toBeUndefined()
  })

  it('trims, caps at 40 characters, and clears on empty', async () => {
    expect(await setAccountDisplayName(toni.id, '  Tee  ')).toBe('Tee')
    expect(await setAccountDisplayName(toni.id, 'x'.repeat(60))).toHaveLength(40)
    expect(await setAccountDisplayName(toni.id, '   ')).toBeNull()
    expect(await getDb().meta.get(accountNameKey(toni.id))).toBeUndefined()
  })

  it('is removed with the account when the account is deleted', async () => {
    await setAccountDisplayName(toni.id, 'Tee')
    await forgetUser(toni.id)
    expect(await getDb().meta.get(accountNameKey(toni.id))).toBeUndefined()
  })
})

describe('the greeting name stays with its account', () => {
  it('drops an unsaved draft when another tab signs in as someone else, instead of saving it to them', async () => {
    const ada: AccountUser = { id: '55555555-5555-4555-8555-555555555555', email: 'ada@example.com', firstName: 'Ada', fullName: 'Ada Lovelace' }
    let switchUser: (u: AccountUser | null) => void = () => {}
    const c: AccountClient = { ...client(toni), onChange: (cb) => {
      switchUser = cb
      return () => {}
    } }
    window.localStorage.setItem('sb-test-auth-token', '{}')
    const events = userEvent.setup()
    render(<AccountProvider configured load={async () => c}><AppHeader /></AccountProvider>)
    await events.click(await screen.findByRole('button', { name: /^Account: Toni/ }))
    const field = screen.getByRole('textbox', { name: 'Name in the greeting' })
    await events.clear(field)
    await events.type(field, 'Tee')

    act(() => switchUser(ada))

    const now = await screen.findByRole('textbox', { name: 'Name in the greeting' })
    await waitFor(() => expect(now).toHaveValue('Ada'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(await getDb().meta.get(accountNameKey(ada.id))).toBeUndefined()
  })
})
