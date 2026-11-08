import type { AccountClient } from '@/features/account/client'
import type { AccountUser } from '@/features/account/session'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AccountProvider } from '@/features/account/accountProvider'
import { rememberAccount } from '@/features/account/session'
import { FakeRemote } from '@/test/fakeRemote'
import { AppHeader } from '../components/appHeader'
import { TaskList } from '../components/taskList'
import { getDb } from '../store/db'
import { add } from '../store/repository'
import { GUEST } from '../store/types'
import { taskToServer } from './mapping'

// The provider, the header and the list together, with sync running against
// an in-memory server: the wiring the engine's own tests don't cover.

const toni: AccountUser = { id: '22222222-2222-4222-8222-222222222222', email: 'toni@example.com', firstName: 'Toni', fullName: 'Toni Ugwuja' }
const SLOW = { timeout: 6000 }

function client(remote: FakeRemote, overrides: Partial<AccountClient> = {}): AccountClient {
  return {
    currentUser: async () => ({ user: toni, error: null }),
    onChange: () => () => {},
    signInWithGoogle: async () => null,
    signOut: async () => null,
    deleteAccount: async () => null,
    remote,
    ...overrides,
  }
}

function renderApp(c: AccountClient) {
  window.localStorage.setItem('sb-test-auth-token', '{}')
  const user = userEvent.setup()
  render(
    <AccountProvider configured load={async () => c}>
      <AppHeader />
      <TaskList />
    </AccountProvider>,
  )
  return user
}

afterEach(() => window.localStorage.clear())

// Sync waits on real timers (2s after a write), so these get longer than the default 5s.
describe('signed in, with sync running', { timeout: 15_000 }, () => {
  it('shows the account\'s tasks, not the guest\'s, and sends a new task to the server', async () => {
    const remote = new FakeRemote()
    const base = await add({ title: 'scratch' }, { db: getDb(), ownerId: toni.id })
    await getDb().tasks.delete(base.id)
    await remote.push('tasks', [taskToServer({ ...base, title: 'From my laptop' }, toni.id)])
    const user = renderApp(client(remote))

    expect(await screen.findByRole('checkbox', { name: 'From my laptop' }, SLOW)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Water the plants' })).not.toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'New task' }), 'Written on my phone{Enter}')
    await waitFor(() => expect([...remote.rows.tasks.values()].map(t => t.title)).toContain('Written on my phone'), SLOW)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Account: Toni, Synced$/ })).toBeInTheDocument(), SLOW)
  })

  it('offers this device\'s guest tasks once, and adds them to the account', async () => {
    await add({ title: 'Made before signing in' })
    const remote = new FakeRemote()
    const user = renderApp(client(remote))

    const offer = await screen.findByRole('dialog', { name: 'Add 1 task from this device to your account?' }, SLOW)
    await user.click(within(offer).getByRole('button', { name: 'Add to my account' }))
    await waitFor(() => expect([...remote.rows.tasks.values()].map(t => t.title)).toEqual(['Made before signing in']), SLOW)
    expect(screen.queryByRole('dialog', { name: /^Add \d+ task/ })).not.toBeInTheDocument()
    expect(await screen.findByRole('checkbox', { name: 'Made before signing in' })).toBeInTheDocument()
  })

  it('warns before signing out with unsynced changes, and keeps them on the device', async () => {
    const remote = new FakeRemote()
    remote.failing = 'offline'
    const user = renderApp(client(remote))
    await screen.findByRole('button', { name: /^Account: Toni/ }, SLOW)
    await user.type(screen.getByRole('textbox', { name: 'New task' }), 'Not synced yet{Enter}')
    await screen.findByRole('checkbox', { name: 'Not synced yet' })

    await user.click(screen.getByRole('button', { name: /^Account: Toni/ }))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sign out with unsynced changes?' })
    expect(dialog).toHaveTextContent('1 change hasn\'t synced yet')
    await user.click(within(dialog).getByRole('button', { name: 'Sign out anyway' }))

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Not synced yet' })).not.toBeInTheDocument())
    const kept = await getDb().tasks.where('ownerId').equals(toni.id).toArray()
    expect(kept.map(t => [t.title, t.dirty])).toEqual([['Not synced yet', 1]])
    expect(await getDb().tasks.where('ownerId').equals(GUEST).count()).toBeGreaterThan(0)
  })

  it('opened offline with a saved session, stays signed in as the remembered user', async () => {
    rememberAccount(toni)
    await add({ title: 'My own task' }, { ownerId: toni.id })
    const remote = new FakeRemote()
    remote.failing = 'offline'
    renderApp(client(remote, { currentUser: async () => ({ user: null, error: 'Failed to fetch' }) }))

    expect(await screen.findByRole('button', { name: /^Account: Toni, Offline$/ }, SLOW)).toBeInTheDocument()
    expect(await screen.findByRole('checkbox', { name: 'My own task' })).toBeInTheDocument()
  })
})
