import type { GroupKey, TaskGroup } from './group'

export type FocusTarget
  // `group`: wait until the row is in this group, e.g. Done after completing,
  // rather than focusing its old row a moment before it unmounts.
  = | { kind: 'row', id: string, group?: GroupKey }
    | { kind: 'heading', group: GroupKey }
    | { kind: 'add' }

/**
 * Where keyboard focus should go once the task `id` is deleted, so it never
 * falls back to the top of the page:
 * - the next task in the same group;
 * - else that group's heading, if the group still has tasks;
 * - else the next group's heading (or the previous one), so focus stays in
 *   the list, where Ctrl+Z can still undo;
 * - else the add field, when no tasks are left at all.
 */
export function focusAfterRemoving(groups: TaskGroup[], id: string): FocusTarget {
  for (const [g, group] of groups.entries()) {
    const index = group.tasks.findIndex(task => task.id === id)
    if (index === -1)
      continue
    const next = group.tasks[index + 1]
    if (next)
      return { kind: 'row', id: next.id }
    if (group.tasks.length > 1)
      return { kind: 'heading', group: group.key }
    const neighbour = groups[g + 1] ?? groups[g - 1]
    return neighbour ? { kind: 'heading', group: neighbour.key } : { kind: 'add' }
  }
  return { kind: 'add' }
}
