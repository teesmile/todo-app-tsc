import type { Task } from '../store/types'
import type { TaskGroup } from './group'
import { describe, expect, it } from 'vitest'
import { focusAfterRemoving } from './focus'

const t = (id: string) => ({ id }) as Task
const groups: TaskGroup[] = [
  { key: 'today', label: 'Today', tasks: [t('a'), t('b'), t('c')] },
  { key: 'none', label: 'No date', tasks: [t('solo')] },
]

describe('focusAfterRemoving', () => {
  it('moves to the next task in the group', () => {
    expect(focusAfterRemoving(groups, 'a')).toEqual({ kind: 'row', id: 'b' })
  })

  it('moves to the group heading when the last of several tasks goes', () => {
    expect(focusAfterRemoving(groups, 'c')).toEqual({ kind: 'heading', group: 'today' })
  })

  it('moves to a neighbouring group\'s heading when the group empties', () => {
    expect(focusAfterRemoving(groups, 'solo')).toEqual({ kind: 'heading', group: 'today' })
  })

  it('moves to the add field only when no tasks are left at all', () => {
    expect(focusAfterRemoving([{ key: 'none', label: 'No date', tasks: [t('last')] }], 'last')).toEqual({ kind: 'add' })
  })
})

describe('focusAfterRemoving in the Newest list (review 17)', () => {
  it('moves to the previous task when the last one goes, never to the visually hidden heading', () => {
    const a = { id: 'a' } as Task
    const b = { id: 'b' } as Task
    const groups: TaskGroup[] = [{ key: 'newest', label: 'All tasks, newest first', tasks: [a, b] }]
    expect(focusAfterRemoving(groups, 'b')).toEqual({ kind: 'row', id: 'a' })
    expect(focusAfterRemoving(groups, 'a')).toEqual({ kind: 'row', id: 'b' })
  })
})
