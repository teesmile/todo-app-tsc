import type { Category } from '../store/types'
import { describe, expect, it } from 'vitest'
import { duplicatesOf } from './labels'

function label(id: string, name: string, createdAt: number): Category {
  return { id, ownerId: 'u', name, color: 'blue', dirty: 0, rev: 0, createdAt, updatedAt: createdAt, deletedAt: null }
}

describe('duplicatesOf', () => {
  it('points each later same-named label (ignoring case) at the oldest one', () => {
    const work = label('a', 'Work', 1)
    const result = duplicatesOf([label('c', 'work', 3), work, label('b', 'WORK', 2), label('d', 'Home', 4)])
    expect([...result.keys()].sort()).toEqual(['b', 'c'])
    expect(result.get('b')).toBe(work)
    expect(result.get('c')).toBe(work)
  })

  it('finds nothing when every name is different', () => {
    expect(duplicatesOf([label('a', 'Work', 1), label('b', 'Home', 2)]).size).toBe(0)
  })
})
