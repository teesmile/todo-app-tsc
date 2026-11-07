'use client'

import type { TaskStats } from '../store/stats'
import { useId } from 'react'
import { useStats } from '../store/hooks'

const noTasks: TaskStats = { total: 0, completed: 0, active: 0, overdue: 0, dueToday: 0, completedPercentage: 0, activePercentage: 0, recentlyCompleted: [] }

/**
 * Four counts over every task: Done, Open, Overdue, Due today. Four across on
 * a phone, two by two in the tablet-and-up side column. A definition list, so
 * each number is read with its label.
 */
export function StatsSummary() {
  const headingId = useId()
  const stats = useStats() ?? noTasks
  const items = [
    { label: 'Done', value: stats.completed, tone: 'text-green-700' },
    { label: 'Open', value: stats.active, tone: 'text-gray-900' },
    { label: 'Overdue', value: stats.overdue, tone: stats.overdue > 0 ? 'text-red-600' : 'text-gray-900' },
    { label: 'Due today', value: stats.dueToday, tone: 'text-orange-700' },
  ]

  return (
    <section aria-labelledby={headingId} className="rounded-2xl border border-gray-200 bg-white p-4">
      <h2 id={headingId} className="mb-3 text-sm font-semibold text-gray-700">
        Summary
        {stats.total > 0 && (
          <span className="font-normal text-gray-500">
            {' · '}
            {stats.completedPercentage}
            % done
          </span>
        )}
      </h2>
      <dl className="grid grid-cols-4 gap-2 md:grid-cols-2">
        {items.map(item => (
          <div key={item.label} className="flex flex-col-reverse items-center rounded-xl bg-gray-50 px-1 py-2 text-center">
            <dt className="text-xs leading-tight text-gray-600">{item.label}</dt>
            <dd className={`text-xl font-bold tabular-nums ${item.tone}`}>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
