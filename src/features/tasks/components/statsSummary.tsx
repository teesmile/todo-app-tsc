'use client'

import type { TaskStats } from '../store/stats'
import { useId } from 'react'
import { useStats } from '../store/hooks'

const LABELS = ['Done', 'Open', 'Overdue', 'Due today'] as const

function itemsFor(stats: TaskStats) {
  return [
    { label: LABELS[0], value: stats.completed, tone: 'text-green-700' },
    { label: LABELS[1], value: stats.active, tone: 'text-gray-900' },
    { label: LABELS[2], value: stats.overdue, tone: stats.overdue > 0 ? 'text-red-600' : 'text-gray-900' },
    { label: LABELS[3], value: stats.dueToday, tone: 'text-orange-700' },
  ]
}

/**
 * Four counts over every task: Done, Open, Overdue, Due today. Four across on
 * a phone, two by two in the tablet-and-up side column. A definition list, so
 * each number is read with its label. Until the tasks have been read it
 * says it's loading (dashes, aria-busy) instead of claiming zeros.
 */
export function StatsSummary() {
  const headingId = useId()
  const stats = useStats()
  const items = stats ? itemsFor(stats) : LABELS.map(label => ({ label, value: null, tone: 'text-gray-400' }))

  return (
    <section aria-labelledby={headingId} aria-busy={stats ? undefined : true} className="rounded-2xl border border-gray-200 bg-white p-4">
      <h2 id={headingId} className="mb-3 text-sm font-semibold text-gray-700">
        Summary
        {stats && stats.total > 0 && (
          <span className="font-normal text-gray-500">
            {' · '}
            {stats.completedPercentage}
            % done
          </span>
        )}
      </h2>
      {!stats && <p className="sr-only">Loading your tasks…</p>}
      <dl className="grid grid-cols-4 gap-2 md:grid-cols-2">
        {items.map(item => (
          <div key={item.label} className="flex flex-col-reverse items-center rounded-xl bg-gray-50 px-1 py-2 text-center">
            <dt className="text-xs leading-tight text-gray-600">{item.label}</dt>
            <dd className={`text-xl font-bold tabular-nums ${item.tone}`}>
              {item.value ?? <span aria-hidden="true">–</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
