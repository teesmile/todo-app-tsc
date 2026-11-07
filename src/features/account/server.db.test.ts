import type { TestUser } from '@/test/localSupabase'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { adminClient, anonClient, createUser } from '@/test/localSupabase'

/**
 * Row-level security, grants and the sync trigger, against a real Postgres
 * through the real Data API. Two users, A and B, for each table.
 */

const iso = (ms: number) => new Date(ms).toISOString()
const tables: Record<'tasks' | 'categories', () => Record<string, string>> = {
  tasks: () => ({ id: randomUUID(), title: 'Buy oat milk', updated_at: iso(Date.now()) }),
  categories: () => ({ id: randomUUID(), name: 'Work', color: 'blue', updated_at: iso(Date.now()) }),
}

describe.each(Object.keys(tables) as (keyof typeof tables)[])('%s', (table) => {
  let a: TestUser
  let b: TestUser
  let row: Record<string, string>

  beforeEach(async () => {
    a = await createUser('a')
    b = await createUser('b')
    row = tables[table]()
    const { error } = await a.db.from(table).insert(row)
    expect(error).toBeNull()
  })

  const readAsA = async () => (await a.db.from(table).select('*').eq('id', row.id).single()).data

  it('lets the owner read their row (the explicit grant works)', async () => {
    const mine = await readAsA()
    expect(mine).toMatchObject({ id: row.id, user_id: a.id })
  })

  it('shows B none of A\'s rows, and an anonymous client nothing', async () => {
    const asB = await b.db.from(table).select('*')
    expect(asB.error).toBeNull()
    expect(asB.data).toEqual([])

    const asAnon = await anonClient().from(table).select('*')
    expect(asAnon.data ?? []).toEqual([])
    expect(asAnon.error?.code).toBe('42501')
  })

  it('stops B changing A\'s row: update matches nothing, upsert fails', async () => {
    const before = await readAsA()

    const update = await b.db.from(table).update({ updated_at: iso(Date.now() + 1000) }).eq('id', row.id).select()
    expect(update.data).toEqual([])

    const upsert = await b.db.from(table).upsert({ ...tables[table](), id: row.id, updated_at: iso(Date.now() + 2000) }).select()
    expect(upsert.error).not.toBeNull()

    expect(await readAsA()).toEqual(before)
  })

  it('rejects B inserting a row owned by A, and anonymous inserts', async () => {
    const forged = await b.db.from(table).insert({ ...tables[table](), user_id: a.id })
    expect(forged.error?.code).toBe('42501')
    const anon = await anonClient().from(table).insert(tables[table]())
    expect(anon.error?.code).toBe('42501')
  })

  it('won\'t let an owner hand their row to someone else', async () => {
    const moved = await a.db.from(table).update({ user_id: b.id, updated_at: iso(Date.now() + 1000) }).eq('id', row.id).select()
    expect(moved.error).not.toBeNull()
    expect((await readAsA())?.user_id).toBe(a.id)
  })

  it('has no delete: rows only go as tombstones or with the account', async () => {
    const deleted = await a.db.from(table).delete().eq('id', row.id)
    expect(deleted.error?.code).toBe('42501')
    expect(await readAsA()).not.toBeNull()
  })

  it('ignores an update older than the stored row (last write wins)', async () => {
    const before = await readAsA()
    const stale = table === 'tasks' ? { title: 'Stale edit' } : { name: 'Stale edit' }
    await a.db.from(table).update({ ...stale, updated_at: iso(Date.now() - 60_000) }).eq('id', row.id)
    const after = await readAsA()
    expect(after?.[table === 'tasks' ? 'title' : 'name']).toBe(before?.[table === 'tasks' ? 'title' : 'name'])
    expect(after?.updated_at).toBe(before?.updated_at)
  })

  it('keeps a tombstone even when a newer edit tries to clear it', async () => {
    const deletedAt = iso(Date.now() + 1000)
    await a.db.from(table).update({ deleted_at: deletedAt, updated_at: deletedAt }).eq('id', row.id)
    await a.db.from(table).update({ deleted_at: null, updated_at: iso(Date.now() + 2000) }).eq('id', row.id)
    expect(new Date((await readAsA())?.deleted_at ?? 0).getTime()).toBe(new Date(deletedAt).getTime())
  })

  it('clamps a future updated_at to at most five minutes ahead', async () => {
    await a.db.from(table).update({ updated_at: iso(Date.now() + 24 * 3600_000) }).eq('id', row.id)
    const stored = new Date((await readAsA())?.updated_at ?? 0).getTime()
    expect(stored).toBeLessThanOrEqual(Date.now() + 5 * 60_000 + 5000)
    expect(stored).toBeGreaterThan(Date.now())
  })

  it('moves server_updated_at forward on every write, whatever the client sends', async () => {
    const first = (await readAsA())?.server_updated_at
    await a.db.from(table).update({ server_updated_at: iso(0), updated_at: iso(Date.now() + 1000) }).eq('id', row.id)
    const second = (await readAsA())?.server_updated_at
    // An ignored (stale) write still counts as a write.
    await a.db.from(table).update({ updated_at: iso(0) }).eq('id', row.id)
    const third = (await readAsA())?.server_updated_at
    expect(new Date(second!).getTime()).toBeGreaterThan(new Date(first!).getTime())
    expect(new Date(third!).getTime()).toBeGreaterThan(new Date(second!).getTime())
  })
})

describe('functions', () => {
  it('ping answers anyone holding the public key, touching no table', async () => {
    const { data, error } = await anonClient().rpc('ping')
    expect(error).toBeNull()
    expect(data).toBe(1)
  })

  it('delete_my_account removes the caller and their rows, and nobody else\'s', async () => {
    const a = await createUser('a')
    const b = await createUser('b')
    const task = { id: randomUUID(), title: 'A\'s task' }
    const label = { id: randomUUID(), name: 'A\'s label', color: 'red' }
    expect((await a.db.from('tasks').insert(task)).error).toBeNull()
    expect((await a.db.from('categories').insert(label)).error).toBeNull()
    expect((await b.db.from('tasks').insert({ id: randomUUID(), title: 'B\'s task' })).error).toBeNull()

    expect((await anonClient().rpc('delete_my_account', { expected_user_id: a.id })).error).not.toBeNull()
    expect((await a.db.rpc('delete_my_account', { expected_user_id: a.id })).error).toBeNull()

    const admin = adminClient()
    expect((await admin.auth.admin.getUserById(a.id)).data.user).toBeNull()
    expect((await admin.auth.admin.getUserById(b.id)).data.user).not.toBeNull()
    // A's rows went with the account (on delete cascade); B's are untouched.
    expect((await a.db.from('tasks').select('id')).data).toEqual([])
    expect((await a.db.from('categories').select('id')).data).toEqual([])
    expect((await b.db.from('tasks').select('title')).data).toEqual([{ title: 'B\'s task' }])
  })
  it('delete_my_account refuses when the confirmed account isn\'t the signed-in one (review 9)', async () => {
    const a = await createUser('a')
    const b = await createUser('b')
    const refused = await a.db.rpc('delete_my_account', { expected_user_id: b.id })
    expect(refused.error?.code).toBe('42501')
    const admin = adminClient()
    expect((await admin.auth.admin.getUserById(a.id)).data.user).not.toBeNull()
    expect((await admin.auth.admin.getUserById(b.id)).data.user).not.toBeNull()
  })
})
