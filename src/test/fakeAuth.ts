import type { AccountClient } from '@/features/account/client'
import type { AccountUser } from '@/features/account/session'
import { accountUserFrom, DISPLAY_NAME_KEY } from '@/features/account/session'
import { FakeRemote } from './fakeRemote'

interface StoredUser { id: string, email: string, user_metadata: Record<string, unknown> }

/**
 * A stand-in for Supabase Auth shared by several "devices": each client()
 * is one device signed in as one user, and they see the same user metadata,
 * as real devices do. Lets a test change the greeting name on one device and
 * watch it reach another.
 */
export class FakeAuth {
  readonly users = new Map<string, StoredUser>()
  /** When set, saving metadata fails, as it would offline. */
  failing: string | null = null
  /** When set, saving metadata waits for this before it completes. */
  gate: Promise<void> | null = null
  updates = 0
  /** Which user each client's session belongs to now (the SDK's session can change under a client). */
  private readonly sessions = new WeakMap<AccountClient, { userId: string }>()

  /** Another tab signed this client's browser in as `userId`. */
  switchSession(client: AccountClient, userId: string) {
    this.sessions.get(client)!.userId = userId
  }

  addUser(id: string, email: string, googleName: string, extra: Record<string, unknown> = {}): AccountUser {
    const user = { id, email, user_metadata: { full_name: `${googleName} Ugwuja`, given_name: googleName, ...extra } }
    this.users.set(id, user)
    return accountUserFrom(user)
  }

  client(userId: string, overrides: Partial<AccountClient> = {}): AccountClient {
    const session = { userId }
    const current = () => accountUserFrom(this.users.get(session.userId)!)
    const client: AccountClient = {
      currentUser: async () => ({ user: current(), error: null }),
      onChange: () => () => {},
      signInWithGoogle: async () => null,
      signOut: async () => null,
      deleteAccount: async () => null,
      setDisplayName: async (name, expectedUserId) => {
        if (this.gate)
          await this.gate
        if (this.failing)
          return { user: null, error: this.failing }
        if (session.userId !== expectedUserId)
          return { user: null, error: 'This is no longer the account the name was for' }
        this.updates++
        const stored = this.users.get(session.userId)!
        stored.user_metadata = { ...stored.user_metadata, [DISPLAY_NAME_KEY]: name }
        return { user: current(), error: null }
      },
      refreshUser: async () => current(),
      remote: new FakeRemote(),
      ...overrides,
    }
    this.sessions.set(client, session)
    return client
  }
}
