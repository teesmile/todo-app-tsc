'use client'

import type { TaskStats } from '@/features/tasks/store/stats'
import { Suspense } from 'react'
import { TaskList } from '@/features/tasks/components/taskList'
import { retryLegacyImport, useLegacyImport, useStats } from '@/features/tasks/store/hooks'

const noTasks: TaskStats = { total: 0, completed: 0, active: 0, overdue: 0, dueToday: 0, completedPercentage: 0, activePercentage: 0, recentlyCompleted: [] }

export default function Home() {
  // Stats over every task (audit 1.4); zeros until the first read lands.
  const stats = useStats() ?? noTasks
  const importStatus = useLegacyImport()

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo */}
              <div className="flex items-center">
                <h1 className="text-2xl font-bold">
                  <span className="text-orange-500">Dash</span>
                  <span className="text-black">board</span>
                </h1>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <main>
            {importStatus === 'failed' && (
              <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <p>
                  Some tasks from the previous version couldn&apos;t be brought over yet. They&apos;re still saved on this device.
                </p>
                <button
                  type="button"
                  onClick={() => retryLegacyImport()}
                  className="rounded-md bg-white px-3 py-1 font-medium text-red-800 ring-1 ring-red-300 hover:bg-red-100"
                >
                  Try again
                </button>
              </div>
            )}
            {importStatus === 'blocked' && (
              <p role="status" className="mb-6 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                Close any other tabs of this app to finish bringing over your tasks from the previous version.
              </p>
            )}
            <div className="grid grid-cols-12 gap-6">
              {/* Todo List */}
              <div className="col-span-8">
                <div className="bg-white rounded-2xl shadow-sm border">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">To-Do</h2>
                  </div>
                  <div className="p-6">
                    <TaskList />
                  </div>
                </div>
              </div>

              {/* Right Sidebar - DYNAMIC */}
              <div className="col-span-4">
                {/* Task Status - Dynamic */}
                <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Status</h3>

                  {stats.total === 0
                    ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No tasks yet</p>
                          <p className="text-sm text-gray-400">Create your first task to see statistics</p>
                        </div>
                      )
                    : (
                        <div className="grid grid-cols-2 gap-4">
                          {/* Completed Circle */}
                          <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-2 relative">
                              <svg
                                className="w-16 h-16 transform -rotate-90"
                                viewBox="0 0 100 100"
                                role="img"
                                aria-label={`${stats.completedPercentage}% completed: ${stats.completed} of ${stats.total} tasks done`}
                              >
                                {/* Background circle */}
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="40"
                                  stroke="rgb(187 247 208)" // green-200
                                  strokeWidth="8"
                                  fill="transparent"
                                />
                                {/* Progress circle */}
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="40"
                                  stroke="rgb(34 197 94)" // green-500
                                  strokeWidth="8"
                                  fill="transparent"
                                  strokeDasharray={`${stats.completedPercentage * 2.51} 251.2`}
                                  strokeLinecap="round"
                                  className="transition-all duration-1000 ease-in-out"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                                <span className="text-lg font-bold text-green-500">
                                  {stats.completedPercentage}
                                  %
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">
                              Completed
                            </p>
                          </div>

                          {/* In Progress Circle */}
                          <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-2 relative">
                              <svg
                                className="w-16 h-16 transform -rotate-90"
                                viewBox="0 0 100 100"
                                role="img"
                                aria-label={`${stats.activePercentage}% in progress: ${stats.active} of ${stats.total} tasks open`}
                              >
                                {/* Background circle */}
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="40"
                                  stroke="rgb(254 215 170)" // orange-200
                                  strokeWidth="8"
                                  fill="transparent"
                                />
                                {/* Progress circle */}
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="40"
                                  stroke="rgb(249 115 22)" // orange-500
                                  strokeWidth="8"
                                  fill="transparent"
                                  strokeDasharray={`${stats.activePercentage * 2.51} 251.2`}
                                  strokeLinecap="round"
                                  className="transition-all duration-1000 ease-in-out"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                                <span className="text-lg font-bold text-orange-500">
                                  {stats.activePercentage}
                                  %
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">
                              In Progress
                            </p>
                          </div>
                        </div>
                      )}
                  <dl className="mt-4 grid grid-cols-2 gap-4 text-center text-sm">
                    <div>
                      <dt className="text-gray-600">Overdue</dt>
                      <dd className={`text-lg font-bold ${stats.overdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>{stats.overdue}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Due today</dt>
                      <dd className="text-lg font-bold text-gray-900">{stats.dueToday}</dd>
                    </div>
                  </dl>
                </div>

                {/* Completed Tasks - Dynamic */}
                <div className="bg-white rounded-2xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Completed Tasks (
                    {stats.completed}
                    )
                  </h3>

                  {/* Dynamic completed tasks */}
                  <div className="space-y-3">
                    {stats.recentlyCompleted.length === 0
                      ? (
                          <div className="text-center py-4">
                            <p className="text-gray-500 text-sm">No completed tasks yet</p>
                          </div>
                        )
                      : (
                          stats.recentlyCompleted.map(todo => (
                            <div key={todo.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm">✓</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {todo.title}
                                </p>
                                <p className="text-xs text-gray-500">Completed</p>
                              </div>
                            </div>
                          ))
                        )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </Suspense>
  )
}
