import type { SupabaseClient } from '@supabase/supabase-js'
import { Buffer } from 'node:buffer'
import { createHmac, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { inject } from 'vitest'

const local = () => inject('supabase')
const noSession = { auth: { persistSession: false, autoRefreshToken: false } }

function base64url(value: object | Buffer) {
  return (Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value))).toString('base64url')
}

/**
 * A user access token for the local stack, signed with its JWT secret. The
 * project has email sign-in off and Google can't run in a test, so tests mint
 * the same token Supabase Auth would issue after a sign-in.
 */
function accessToken(userId: string) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url({ alg: 'HS256', typ: 'JWT' })
  const payload = base64url({ sub: userId, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })
  const signature = base64url(createHmac('sha256', local().jwtSecret).update(`${header}.${payload}`).digest())
  return `${header}.${payload}.${signature}`
}

/** The local stack's Postgres URL (its own development credentials, never production's). */
export function localDbUrl(): string {
  return local().dbUrl
}

/** The local stack's admin client, used only to create and inspect users. */
export function adminClient(): SupabaseClient {
  return createClient(local().url, local().secretKey, noSession)
}

/** A signed-out client: what anyone holding the public key gets. */
export function anonClient(): SupabaseClient {
  return createClient(local().url, local().publishableKey, noSession)
}

export interface TestUser {
  id: string
  db: SupabaseClient
}

/** A fresh user and a client signed in as them. */
export async function createUser(label: string): Promise<TestUser> {
  const { data, error } = await adminClient().auth.admin.createUser({ email: `${label}-${randomUUID()}@example.test`, email_confirm: true })
  if (error || !data.user)
    throw new Error(`Couldn't create test user: ${error?.message}`)
  const db = createClient(local().url, local().publishableKey, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${accessToken(data.user.id)}` } },
  })
  return { id: data.user.id, db }
}

/** Another client signed in as an existing user: a second device. */
export function clientFor(userId: string): SupabaseClient {
  return createClient(local().url, local().publishableKey, {
    ...noSession,
    global: { headers: { Authorization: `Bearer ${accessToken(userId)}` } },
  })
}
