import type { SupabaseClient } from '@supabase/supabase-js'
import type { Outgoing, Remote, RemoteErrorKind, ServerRows, SyncTable } from './types'
import { RemoteError } from './types'

/** Sorts a failed request into what the app tells the user. */
export function classifyFailure(status: number, error: { message?: string, code?: string }): RemoteErrorKind {
  const message = error.message ?? ''
  if (status === 0 || /failed to fetch|networkerror|network request failed|load failed/i.test(message))
    return 'offline'
  if (status === 401 || error.code === 'PGRST301' || error.code === 'PGRST303' || /jwt/i.test(message))
    return 'auth'
  if (status >= 500 || status === 408 || status === 429)
    return 'unavailable'
  return 'rejected'
}

function fail(status: number, error: { message?: string, code?: string }): never {
  throw new RemoteError(classifyFailure(status, error), error.message ?? 'Sync failed')
}

/**
 * The real server: the Data API, under row-level security as the signed-in
 * user. Pulls page by (server_updated_at, id) using the index the migration
 * created; pushes upsert and return each row as the trigger stored it.
 */
export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async pull<T extends SyncTable>(table: T, { since, after, limit }: { since: string, after: { ts: string, id: string } | null, limit: number }) {
      let query = client.from(table).select('*').gte('server_updated_at', since)
      if (after) {
        // Quoted: timestamps contain ':' and '.', which the filter syntax reserves.
        query = query.or(`server_updated_at.gt."${after.ts}",and(server_updated_at.eq."${after.ts}",id.gt.${after.id})`)
      }
      const { data, error, status } = await query.order('server_updated_at').order('id').limit(limit)
      if (error)
        fail(status, error)
      return (data ?? []) as ServerRows[T][]
    },
    async push<T extends SyncTable>(table: T, rows: Outgoing<T>[]) {
      if (rows.length === 0)
        return []
      // The SDK types upsert per table; the engine is generic over both tables.
      const { data, error, status } = await client.from(table).upsert(rows as never, { onConflict: 'id' }).select('*')
      if (error)
        fail(status, error)
      return (data ?? []) as ServerRows[T][]
    },
  }
}
