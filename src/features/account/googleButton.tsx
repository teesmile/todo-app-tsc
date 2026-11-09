'use client'

import type { GoogleIdApi } from './googleIdentity'
import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { forgetGoogleIdentityLoader, googleClientId, loadGoogleIdentity, makeNonce } from './googleIdentity'

/**
 * The fallback: Google's sign-in button design, built to its branding guidelines (styles in
 * globals.css, `.gsi-button`): the official G from Google's asset bundle
 * (public/google-g.svg, unaltered), "Continue with Google" in Google Sans
 * Medium, light or dark with the system theme. A real <button>; the logo is
 * decorative, so the accessible name is the text.
 */
export function GoogleSignInButton({ onClick, disabled = false, busy = false }: { onClick: () => void, disabled?: boolean, busy?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="gsi-button w-full">
      <span className="gsi-button-state" aria-hidden="true" />
      <Image src="/google-g.svg" alt="" width={20} height={20} unoptimized className="gsi-button-icon relative" />
      <span className="gsi-button-text">{busy ? 'Opening Google…' : 'Continue with Google'}</span>
    </button>
  )
}

/**
 * How long Google's button has to appear, counted from when the dialog
 * shows it. Covers a script that stalls without failing as well as a site
 * Google refuses (an empty frame).
 */
const GOOGLE_BUTTON_DEADLINE_MS = 6000

/**
 * Google's own button, drawn by Google Identity Services. Signing in happens
 * in a popup or the browser's own panel, never by navigating this page, so
 * Back from the signed-in app goes to wherever the person came from. Calls
 * `onCredential` with Google's ID token and the raw nonce whose hash is in
 * it, or `onUnavailable` when Google's script can't load (offline, blocked,
 * no client ID), so the dialog can fall back to the redirect flow.
 */
export function GoogleIdentityButton({ onCredential, onUnavailable, load = loadGoogleIdentity }: {
  onCredential: (token: string, rawNonce: string) => void
  onUnavailable: () => void
  load?: () => Promise<GoogleIdApi>
}) {
  const container = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onCredential, onUnavailable })
  useEffect(() => {
    callbacks.current = { onCredential, onUnavailable }
  })

  useEffect(() => {
    let cancelled = false
    const clientId = googleClientId()
    if (!clientId) {
      callbacks.current.onUnavailable()
      return
    }
    // One deadline from the start (review 15). Google's button counts
    // as drawn when something is in the container and it isn't a zero-size
    // frame, which is what Google draws for a site it hasn't approved (any
    // origin not on the OAuth client, such as a preview URL).
    const deadline = setTimeout(() => {
      const parent = container.current
      if (cancelled || !parent)
        return
      const frame = parent.querySelector('iframe')
      const box = frame?.getBoundingClientRect()
      const drawn = parent.childElementCount > 0 && !(frame && (!box?.width || !box?.height))
      if (!drawn) {
        forgetGoogleIdentityLoader()
        callbacks.current.onUnavailable()
      }
    }, GOOGLE_BUTTON_DEADLINE_MS)
    void (async () => {
      try {
        // A fresh nonce for each time the button is drawn.
        const [api, nonce] = await Promise.all([load(), makeNonce()])
        const parent = container.current
        if (cancelled || !parent)
          return
        api.initialize({
          client_id: clientId,
          nonce: nonce.hashed,
          ux_mode: 'popup',
          use_fedcm_for_button: true,
          auto_select: false,
          callback: response => callbacks.current.onCredential(response.credential, nonce.raw),
        })
        const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
        api.renderButton(parent, {
          type: 'standard',
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: Math.min(400, Math.round(parent.getBoundingClientRect().width) || 320),
        })
      }
      catch {
        if (!cancelled)
          callbacks.current.onUnavailable()
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(deadline)
    }
  }, [load])

  return <div ref={container} data-testid="google-identity-button" className="flex min-h-10 w-full justify-center" />
}
