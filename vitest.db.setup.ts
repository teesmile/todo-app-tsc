import type { TestProject } from 'vitest/node'
import { execFileSync } from 'node:child_process'

export interface LocalSupabase {
  url: string
  publishableKey: string
  secretKey: string
  jwtSecret: string
  /** The local stack's own Postgres, for tests that need a raw transaction. */
  dbUrl: string
}

declare module 'vitest' {
  export interface ProvidedContext {
    supabase: LocalSupabase
  }
}

/**
 * Reads the local stack's URL and keys from `supabase status`. These are the
 * local stack's own development keys, never the project's: the setup refuses
 * to run against anything but localhost, so a test can't touch production.
 */
export default function setup(project: TestProject) {
  const raw = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const status = JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, string>
  const url = status.API_URL ?? ''
  if (!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(url))
    throw new Error('pnpm test:db only runs against the local Supabase stack (run `supabase start`).')
  project.provide('supabase', {
    url,
    publishableKey: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
    secretKey: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
    jwtSecret: status.JWT_SECRET,
    dbUrl: status.DB_URL,
  })
}
