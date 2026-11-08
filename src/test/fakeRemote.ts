import type { Outgoing, PullRequest, Remote, RemoteErrorKind, ServerRows, SyncTable } from '@/features/tasks/sync/types'
import { compareStamps, toMicros } from '@/features/tasks/sync/time'
import { RemoteError } from '@/features/tasks/sync/types'

const FIVE_MINUTES_US = 5 * 60 * 1_000_000

/** Microseconds since the epoch, as Postgres prints a timestamptz through the Data API. */
export function stampFromMicros(us: number): string {
  const date = new Date(Math.floor(us / 1000)).toISOString().slice(0, 19)
  return `${date}.${(us % 1_000_000).toString().padStart(6, '0')}+00:00`
}

/**
 * An in-memory server with the same rules as the Postgres trigger in
 * supabase/migrations: last write wins on `updated_at`, a tombstone is
 * final, `updated_at` is clamped to five minutes ahead of the server's clock,
 * and `server_updated_at` always moves forward. One user's rows only.
 */
export class FakeRemote implements Remote {
  readonly rows: { [T in SyncTable]: Map<string, ServerRows[T]> } = { categories: new Map(), tasks: new Map() }
  /** Set to make every call fail as if the network, the server or the session were down. */
  failing: RemoteErrorKind | null = null
  pushCalls = 0
  private lastStamp = 0

  constructor(private readonly clock: () => number = Date.now) {}

  private stamp(): string {
    const now = this.clock() * 1000
    this.lastStamp = now > this.lastStamp ? now : this.lastStamp + 1
    return stampFromMicros(this.lastStamp)
  }

  private check() {
    if (this.failing)
      throw new RemoteError(this.failing, `fake remote: ${this.failing}`)
  }

  private clamp(updatedAt: string): string {
    const limit = this.clock() * 1000 + FIVE_MINUTES_US
    return toMicros(updatedAt) > limit ? stampFromMicros(limit) : updatedAt
  }

  async push<T extends SyncTable>(table: T, incoming: Outgoing<T>[]): Promise<ServerRows[T][]> {
    this.check()
    this.pushCalls++
    const store = this.rows[table] as Map<string, ServerRows[T]>
    return incoming.map((row) => {
      const old = store.get(row.id)
      let next: ServerRows[T]
      if (!old) {
        next = { ...row, updated_at: this.clamp(row.updated_at), server_updated_at: this.stamp() } as ServerRows[T]
      }
      else {
        if (old.user_id !== row.user_id)
          throw new RemoteError('rejected', 'new row violates row-level security policy')
        const tombstone = old.deleted_at ?? row.deleted_at
        const base = compareStamps(row.updated_at, old.updated_at) <= 0
          ? { ...old }
          : { ...old, ...row, updated_at: this.clamp(row.updated_at) }
        next = { ...base, deleted_at: tombstone, server_updated_at: this.stamp() } as ServerRows[T]
      }
      store.set(row.id, next)
      return structuredClone(next)
    })
  }

  async pull<T extends SyncTable>(table: T, { since, after, limit }: PullRequest): Promise<ServerRows[T][]> {
    this.check()
    const store = this.rows[table] as Map<string, ServerRows[T]>
    return [...store.values()]
      .filter(row => compareStamps(row.server_updated_at, since) >= 0)
      .filter(row => !after || compareStamps(row.server_updated_at, after.ts) > 0 || (row.server_updated_at === after.ts && row.id > after.id))
      .sort((a, b) => compareStamps(a.server_updated_at, b.server_updated_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, limit)
      .map(row => structuredClone(row))
  }

  /**
   * Stores a row stamped `micros`, bypassing the clock: a transaction that
   * took its `now()` earlier and committed only now.
   */
  commitLate<T extends SyncTable>(table: T, row: Outgoing<T>, micros: number) {
    (this.rows[table] as Map<string, ServerRows[T]>).set(row.id, { ...row, server_updated_at: stampFromMicros(micros) } as ServerRows[T])
  }
}
