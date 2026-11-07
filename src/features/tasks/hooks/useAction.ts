'use client'

import { useCallback, useState } from 'react'

/**
 * Pending and error state for one async store call, the part of
 * `useMutation` the UI actually used. There's no cache to invalidate: the
 * live query re-renders by itself once the write commits.
 *
 * `run` re-throws, for callers that act on success. `fire` swallows the error
 * into `error`, for buttons that only need to show it.
 */
export function useAction<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const run = useCallback(async (...args: Args): Promise<Result> => {
    setPending(true)
    setError(null)
    try {
      return await action(...args)
    }
    catch (caught) {
      setError(caught)
      throw caught
    }
    finally {
      setPending(false)
    }
  }, [action])

  const fire = useCallback((...args: Args) => {
    run(...args).catch(() => {})
  }, [run])

  /** Clears a shown error, e.g. when the user backs out of a conflict. */
  const reset = useCallback(() => setError(null), [])

  return { run, fire, reset, pending, error }
}
