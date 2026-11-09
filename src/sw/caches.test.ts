import { describe, expect, it } from 'vitest'
import { cachesToDelete, META_CACHE } from './caches'

const A = 'todo-app-aaaa'
const B = 'todo-app-bbbb'
const C = 'todo-app-cccc'

describe('which caches a new version deletes (review 19)', () => {
  it('keeps the version that was active, not a failed install made after it', () => {
    // A active; B's install failed and left a cache; C activates.
    expect(cachesToDelete([A, B, C], C, A)).toEqual([B])
  })

  it('keeps only the new and the previous version, however many are left', () => {
    expect(cachesToDelete(['todo-app-old', A, B, C], C, B)).toEqual(['todo-app-old', A])
  })

  it('without a record, keeps the newest other cache', () => {
    expect(cachesToDelete([A, B, C], C, null)).toEqual([A])
  })

  it('never touches the record itself or anything not the app\'s', () => {
    expect(cachesToDelete([META_CACHE, 'someone-else', A, C], C, A)).toEqual([])
  })
})
