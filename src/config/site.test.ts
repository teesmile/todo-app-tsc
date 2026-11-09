import { describe, expect, it } from 'vitest'
import { movedTo, SITE_URL } from './site'

describe('the old address', () => {
  it('points the old host at the same path and query on the new address', () => {
    expect(movedTo({ hostname: 'todo-app-tsc-mauve.vercel.app', pathname: '/privacy', search: '?x=1' })).toBe(`${SITE_URL}/privacy?x=1`)
  })

  it('leaves the new address, previews and localhost alone', () => {
    for (const hostname of ['todo.anthonyugwuja.dev', 'todo-app-git-revamp-teesmiles-projects.vercel.app', 'localhost'])
      expect(movedTo({ hostname, pathname: '/', search: '' })).toBeNull()
  })
})
