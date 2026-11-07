// Next inlines NEXT_PUBLIC_* at build time only when they're written out in
// full like this (so the global `process`, not an import). With either one
// unset (a fresh clone, CI), the app is guest-only and the sign-in button
// isn't rendered.
/* eslint-disable node/prefer-global/process */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
/* eslint-enable node/prefer-global/process */

export function accountsConfigured(url = SUPABASE_URL, key = SUPABASE_PUBLISHABLE_KEY): boolean {
  return Boolean(url && key)
}

export type SignInMethod = 'google'

/**
 * THE SWITCH for sign-in methods: the dialog shows one button per entry.
 *
 * Email is off until custom SMTP exists, because Supabase's built-in mailer
 * only delivers to the project's team. Turning it on is the checklist in
 * docs/plan.md, Phase 9, "Turning on email sign-in": configure SMTP, set
 * `[auth.email] enabled = true` in supabase/config.toml and push it, build
 * the email form, then add 'email' to SignInMethod and to this list.
 */
export const SIGN_IN_METHODS: readonly SignInMethod[] = ['google']
