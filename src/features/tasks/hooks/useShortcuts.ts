'use client'

import { useEffect, useRef } from 'react'

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'])

/**
 * Whether a keystroke on `target` is someone typing. Text inputs, textareas,
 * selects and contenteditable regions count; checkboxes, radios and buttons
 * don't, so `n` still works while focus sits on a task's checkbox.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement))
    return false
  if (target.closest('[contenteditable]:not([contenteditable="false"])'))
    return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)
    return true
  if (target instanceof HTMLInputElement)
    return !NON_TEXT_INPUTS.has(target.type)
  return false
}

/**
 * Single-key shortcuts on the whole document. Skipped while typing and while
 * Ctrl, Meta or Alt is held, so they never steal a character or a browser
 * shortcut. Keys are matched exactly: `n`, not Shift+N.
 */
export function useShortcuts(handlers: Record<string, () => void>) {
  const current = useRef(handlers)
  useEffect(() => {
    current.current = handlers
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target))
        return
      const handler = current.current[event.key]
      if (!handler)
        return
      // `/` would otherwise open Firefox's quick find.
      event.preventDefault()
      handler()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
