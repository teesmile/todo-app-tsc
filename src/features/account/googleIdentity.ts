/**
 * Google Identity Services (GIS): Google's own sign-in button, which signs in
 * with a popup or the browser's own sign-in panel and hands back an ID token,
 * so the page never navigates and no sign-in pages enter the history. The
 * token goes to Supabase with `signInWithIdToken`.
 *
 * The script comes from accounts.google.com and is loaded only when the
 * sign-in dialog shows the button: a guest who never opens it makes no
 * request to Google.
 */

/**
 * The OAuth client ID (public by design). Next inlines NEXT_PUBLIC_* where
 * it's written out in full, so this is a build-time constant in the app; a
 * function so tests can set it.
 */
export function googleClientId(): string {
  // eslint-disable-next-line node/prefer-global/process
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** The part of the GIS API this app uses. */
export interface GoogleIdApi {
  initialize: (config: {
    client_id: string
    callback: (response: { credential: string }) => void
    nonce: string
    ux_mode: 'popup'
    use_fedcm_for_button?: boolean
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (parent: HTMLElement, options: {
    type: 'standard'
    theme: 'outline' | 'filled_black'
    size: 'large'
    text: 'continue_with'
    shape: 'pill'
    logo_alignment: 'left'
    width?: number
  }) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } }
  }
}

let loading: Promise<GoogleIdApi> | null = null

/** Loads Google's script once. Rejects (and lets a later call retry) if it can't load. */
export function loadGoogleIdentity(): Promise<GoogleIdApi> {
  if (window.google?.accounts?.id)
    return Promise.resolve(window.google.accounts.id)
  loading ??= new Promise<GoogleIdApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('Google sign-in did not load')))
    script.onerror = () => reject(new Error('Google sign-in could not be loaded'))
    document.head.append(script)
  }).catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

/**
 * A fresh nonce for one sign-in attempt: `raw` goes to Supabase, `hashed`
 * (SHA-256, hex) to Google, which seals it into the ID token. Supabase
 * hashes `raw` and requires a match, so a token can't be replayed.
 */
export async function makeNonce(): Promise<{ raw: string, hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hashed = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  return { raw, hashed }
}
