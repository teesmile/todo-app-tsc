'use client'

import { Suspense } from 'react'
import { AppHeader } from '@/features/tasks/components/appHeader'
import { StatsSummary } from '@/features/tasks/components/statsSummary'
import { TaskList } from '@/features/tasks/components/taskList'
import { retryLegacyImport, useLegacyImport } from '@/features/tasks/store/hooks'

/**
 * Mobile-first: one column (header, tasks, then the summary) up to tablet
 * width; from 768px the summary moves to a side column. The bottom padding
 * keeps the last task clear of the phone's floating Add button.
 */
export default function Home() {
  const importStatus = useLegacyImport()

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* The first thing a keyboard reaches: straight past the header to the list. */}
      <a
        href="#tasks"
        // Move focus explicitly: not every browser focuses a fragment target.
        onClick={(e) => {
          const tasks = document.getElementById('tasks')
          if (tasks) {
            e.preventDefault()
            tasks.focus()
            tasks.scrollIntoView?.({ block: 'start' })
          }
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-medium focus:text-gray-900 focus:shadow-lg focus:outline-2 focus:outline-orange-500"
      >
        Skip to tasks
      </a>
      <AppHeader />
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:grid md:grid-cols-[minmax(0,1fr)_15rem] md:items-start md:gap-6 md:pb-8 md:pt-6">
        <main id="tasks" tabIndex={-1} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 focus:outline-none md:p-6">
          <h2 className="sr-only">Tasks</h2>
          {importStatus === 'failed' && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p>
                Some tasks from the previous version couldn&apos;t be brought over yet. They&apos;re still saved on this device.
              </p>
              <button
                type="button"
                onClick={() => retryLegacyImport()}
                className="min-h-11 rounded-md bg-white px-3 font-medium text-red-800 ring-1 ring-red-300 hover:bg-red-100"
              >
                Try again
              </button>
            </div>
          )}
          {importStatus === 'blocked' && (
            <p role="status" className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              Close any other tabs of this app to finish bringing over your tasks from the previous version.
            </p>
          )}
          {/* useSearchParams (in TaskList) needs a Suspense boundary for the static prerender. */}
          <Suspense>
            <TaskList />
          </Suspense>
        </main>
        <aside className="mt-4 md:sticky md:top-6 md:mt-0">
          <StatsSummary />
        </aside>
      </div>
    </div>
  )
}
