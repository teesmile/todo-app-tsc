import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { makeNonce } from './googleIdentity'

describe('the sign-in nonce', () => {
  it('sends Google the SHA-256 (hex) of the raw nonce that goes to Supabase', async () => {
    const { raw, hashed } = await makeNonce()
    expect(raw.length).toBeGreaterThanOrEqual(40)
    expect(hashed).toBe(createHash('sha256').update(raw).digest('hex'))
  })

  it('is different every time', async () => {
    const [a, b] = await Promise.all([makeNonce(), makeNonce()])
    expect(a.raw).not.toBe(b.raw)
  })
})
