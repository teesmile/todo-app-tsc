import type { GroupKey, TaskGroup } from './group'

export type FocusTarget
  = | { kind: 'row', id: string }
    | { kind: 'heading', group: GroupKey }
    | { kind: 'add' }

/**
 * Where keyboard focus should go once the task `id` is deleted, so it never
 * falls back to the top of the page:
 * - the next task in the same group;
 * - else that group's heading, if the group still has tasks;
 * - else the add field, because the group is about to disappear.
 */
export function focusAfterRemoving(groups: TaskGroup[], id: string): FocusTarget {
  for (const group of groups) {
    const index = group.tasks.findIndex(task => task.id === id)
    if (index === -1)
      continue
    const next = group.tasks[index + 1]
    if (next)
      return { kind: 'row', id: next.id }
    if (group.tasks.length > 1)
      return { kind: 'heading', group: group.key }
    return { kind: 'add' }
  }
  return { kind: 'add' }
}
