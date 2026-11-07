'use client'

import type { TaskGroup as Group } from '../lib/group'
import type { Task } from '../store/types'
import { useId } from 'react'
import { TaskItem } from './taskItem'

interface TaskGroupProps {
  group: Group
  onDelete: (task: Task) => void
  /** After a title or due-date edit saves. */
  onSaved?: (task: Task) => void
  onToggled?: (task: Task) => void
  today: string
  now: Date | null
}

/**
 * One group (Overdue, Today, ...) as a labelled section with a list. The
 * heading takes programmatic focus when the last of its tasks is deleted.
 */
export function TaskGroup({ group, onDelete, onSaved, onToggled, today, now }: TaskGroupProps) {
  const headingId = useId()
  const tone = group.key === 'overdue' ? 'text-red-700' : 'text-gray-700'

  return (
    <section aria-labelledby={headingId} data-group={group.key}>
      <h3
        id={headingId}
        tabIndex={-1}
        data-group-heading={group.key}
        className={`mb-2 text-sm font-semibold ${tone} focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500`}
      >
        {group.label}
        {' '}
        <span className="font-normal text-gray-500">
          (
          {group.tasks.length}
          )
        </span>
      </h3>
      <ul className="space-y-2">
        {group.tasks.map(task => (
          <li key={task.id}>
            <TaskItem task={task} onDelete={onDelete} onSaved={onSaved} onToggled={onToggled} today={today} now={now} />
          </li>
        ))}
      </ul>
    </section>
  )
}
