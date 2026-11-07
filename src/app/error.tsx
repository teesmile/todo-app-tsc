'use client'

/**
 * Catches a failed read of the task store. useLiveQuery throws during render
 * rather than returning an error state, so without this boundary a failed
 * IndexedDB open would blank the page.
 */
export default function Error({ reset }: { error: Error & { digest?: string }, reset: () => void }) {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div role="alert" className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Your tasks couldn&apos;t be loaded</h1>
        <p className="text-gray-600 mt-2">
          This browser may be blocking storage for this site, for example in a private window.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
