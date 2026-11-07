import { describe, expect, it } from 'vitest'
import { accountsConfigured, SIGN_IN_METHODS } from './config'
import { callbackError, firstNameFrom, isAuthCallback, mayHaveSession, withoutAuthParams } from './session'

describe('account config', () => {
  it('is guest-only unless both public variables are set', () => {
    expect(accountsConfigured('', '')).toBe(false)
    expect(accountsConfigured('https://x.supabase.co', '')).toBe(false)
    expect(accountsConfigured('https://x.supabase.co', 'sb_publishable_x')).toBe(true)
  })

  it('offers Google only until email sign-in is switched on', () => {
    expect(SIGN_IN_METHODS).toEqual(['google'])
  })
})

describe('session helpers', () => {
  it('spots a saved session or an in-flight sign-in, and nothing else', () => {
    expect(mayHaveSession(['sb-abc-auth-token'])).toBe(true)
    expect(mayHaveSession(['theme', 'sb-abc-auth-token-code-verifier'])).toBe(true)
    expect(mayHaveSession(['theme', 'sb-abc-other'])).toBe(false)
    expect(mayHaveSession([])).toBe(false)
  })

  it('recognises the redirect back from Google, with a code or an error', () => {
    expect(isAuthCallback('?code=abc')).toBe(true)
    expect(isAuthCallback('?error=access_denied&error_description=Denied')).toBe(true)
    expect(isAuthCallback('?filter=overdue')).toBe(false)
    expect(callbackError('?error=access_denied&error_description=The+user+said+no')).toBe('The user said no')
    expect(callbackError('?code=abc')).toBeNull()
  })

  it('removes only the sign-in parameters, keeping the list view', () => {
    expect(withoutAuthParams('https://todo.test/?filter=overdue&code=abc&q=milk'))
      .toBe('/?filter=overdue&q=milk')
    expect(withoutAuthParams('https://todo.test/?error=x&error_code=y&error_description=z')).toBe('/')
    expect(withoutAuthParams('https://todo.test/?filter=overdue')).toBeNull()
  })

  it('greets by the Google first name, falling back to the first word of the full name', () => {
    expect(firstNameFrom({ given_name: 'Toni', full_name: 'Anthony Ugwuja' })).toBe('Toni')
    expect(firstNameFrom({ full_name: '  Anthony Ugwuja ' })).toBe('Anthony')
    expect(firstNameFrom({ name: 'Ada' })).toBe('Ada')
    expect(firstNameFrom({ full_name: '   ' })).toBeNull()
    expect(firstNameFrom(undefined)).toBeNull()
    expect(firstNameFrom({ given_name: 'x'.repeat(60) })).toHaveLength(40)
  })
})
