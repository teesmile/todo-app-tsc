'use client'

import { useId, useState } from 'react'
import { useNow } from '../hooks/useNow'
import { formatLongDate, greetingFor } from '../lib/dates'
import { MAX_NAME_LENGTH, setDisplayName, skipNamePrompt, useProfile } from '../store/profile'

/**
 * "Good morning, Toni · Saturday 7 November". The greeting and date are
 * clock-based, so they render only in the browser (useNow is null on the
 * server), with a neutral heading until then. A first name is asked for
 * once, optional and skippable, and kept on this device.
 */
export function AppHeader() {
  const now = useNow()
  const profile = useProfile()
  const name = profile?.name ?? null
  const askName = profile !== undefined && !profile.promptDone && !name

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
          {now ? `${greetingFor(now.getHours())}${name ? `, ${name}` : ''}` : 'Your tasks'}
        </h1>
        <p className="mt-0.5 text-sm text-gray-600">{now ? formatLongDate(now) : ' '}</p>
        {askName && <NamePrompt />}
      </div>
    </header>
  )
}

function NamePrompt() {
  const id = useId()
  const [draft, setDraft] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setDisplayName(draft).catch(err => console.error('Could not save your name', err))
      }}
      className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-orange-50 p-3"
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-medium text-gray-800">
          What should we call you?
          {' '}
          <span className="font-normal text-gray-600">(optional)</span>
        </label>
        <input
          id={`${id}-name`}
          type="text"
          autoComplete="given-name"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="First name"
          className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!draft.trim()} className="min-h-11 rounded-lg bg-orange-600 px-4 font-medium text-white hover:bg-orange-700 disabled:opacity-50">
          Save
        </button>
        <button
          type="button"
          onClick={() => skipNamePrompt().catch(err => console.error('Could not skip the name prompt', err))}
          className="min-h-11 rounded-lg px-4 font-medium text-gray-700 hover:bg-orange-100"
        >
          Skip
        </button>
      </div>
    </form>
  )
}
