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

  it('moves to the add field when the group empties', () => {
    expect(focusAfterRemoving(groups, 'solo')).toEqual({ kind: 'add' })
  })
})
