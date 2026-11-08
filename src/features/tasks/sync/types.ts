/** The two tables that sync. Labels go first, so a task never arrives pointing at a label the server hasn't seen. */
export type SyncTable = 'categories' | 'tasks'

/** A row of `public.tasks` as the Data API returns it. Timestamps are ISO strings with microseconds. */
export interface ServerTask {
  id: string
  user_id: string
  title: string
  completed: boolean
  due_date: string | null
  vital: boolean
  category_ids: string[]
  created_at: string
  updated_at: string
  completed_at: string | null
  deleted_at: string | null
  server_updated_at: string
}

/** A row of `public.categories`. */
export interface ServerCategory {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  server_updated_at: string
}

export interface ServerRows {
  categories: ServerCategory
  tasks: ServerTask
}

/** What a push sends: everything but the stamp the server sets. */
export type Outgoing<T extends SyncTable> = Omit<ServerRows[T], 'server_updated_at'>

export interface PullRequest {
  /** Only rows stamped at or after this. */
  since: string
  /** Keyset position: only rows after this (server_updated_at, id) pair. */
  after: { ts: string, id: string } | null
  limit: number
}

/**
 * The server, as the engine sees it. The real one is the Data API
 * (`supabaseRemote.ts`); tests use an in-memory one with the same trigger
 * rules. Both reject with a RemoteError.
 */
export interface Remote {
  /** Rows in (server_updated_at, id) order. */
  pull: <T extends SyncTable>(table: T, request: PullRequest) => Promise<ServerRows[T][]>
  /** Upserts and returns each row as the server stored it, after its trigger ran. */
  push: <T extends SyncTable>(table: T, rows: Outgoing<T>[]) => Promise<ServerRows[T][]>
}

/**
 * Why a sync failed. `offline`: no network. `unavailable`: Supabase answered
 * with a server error or is paused. `auth`: the session is no longer valid.
 * `rejected`: the server refused the data itself.
 */
export type RemoteErrorKind = 'offline' | 'unavailable' | 'auth' | 'rejected'

export class RemoteError extends Error {
  constructor(readonly kind: RemoteErrorKind, message: string) {
    super(message)
    this.name = 'RemoteError'
  }
}
