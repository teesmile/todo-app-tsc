import { describe, expect, it } from 'vitest'
import { acceptForPrecache, pageFor, routeFor, urlForFile } from './routing'

const origin = 'https://todo.anthonyugwuja.dev'
// Pages by their clean URL, the way Vercel serves the export (review 18).
const precached = new Set(['/', '/privacy', '/terms', '/404', '/_next/static/chunks/app.js', '/icon.png', '/privacy.txt'])
const get = (url: string, mode = 'no-cors') => ({ url, method: 'GET', mode })

describe('the service worker\'s routing', () => {
  it('never touches Supabase, Google or any other origin', () => {
    expect(routeFor(get('https://owlqryrmefxmzxwwadhn.supabase.co/rest/v1/tasks?select=*'), origin, precached)).toEqual({ kind: 'bypass' })
    expect(routeFor(get('https://owlqryrmefxmzxwwadhn.supabase.co/auth/v1/token', 'cors'), origin, precached)).toEqual({ kind: 'bypass' })
    expect(routeFor(get('https://accounts.google.com/gsi/client'), origin, precached)).toEqual({ kind: 'bypass' })
  })

  it('leaves anything but GET to the network', () => {
    expect(routeFor({ url: `${origin}/index.html`, method: 'POST', mode: 'cors' }, origin, precached)).toEqual({ kind: 'bypass' })
  })

  it('serves page loads from the precached HTML, query and trailing slash ignored', () => {
    expect(routeFor(get(`${origin}/?filter=overdue&sort=due`, 'navigate'), origin, precached)).toEqual({ kind: 'cache', key: '/' })
    expect(routeFor(get(`${origin}/privacy`, 'navigate'), origin, precached)).toEqual({ kind: 'cache', key: '/privacy' })
    expect(routeFor(get(`${origin}/terms/`, 'navigate'), origin, precached)).toEqual({ kind: 'cache', key: '/terms' })
  })

  it('serves the 404 page for an unknown page, so offline never shows the browser\'s error', () => {
    expect(routeFor(get(`${origin}/no-such-page`, 'navigate'), origin, precached)).toEqual({ kind: 'cache', key: '/404' })
  })

  it('serves precached files, and lets anything else same-origin go to the network', () => {
    expect(routeFor(get(`${origin}/_next/static/chunks/app.js`), origin, precached)).toEqual({ kind: 'cache', key: '/_next/static/chunks/app.js' })
    expect(routeFor(get(`${origin}/privacy.txt?_rsc=abc`), origin, precached)).toEqual({ kind: 'cache', key: '/privacy.txt' })
    expect(routeFor(get(`${origin}/something-new.js`), origin, precached)).toEqual({ kind: 'network' })
  })

  it('looks up a build file this version lacks in the caches, for a tab still on the previous version', () => {
    expect(routeFor(get(`${origin}/_next/static/chunks/old-version.js`), origin, precached)).toEqual({ kind: 'cache', key: '/_next/static/chunks/old-version.js' })
  })

  it('keys pages by clean URL, never the .html filename', () => {
    expect(pageFor('/')).toBe('/')
    expect(pageFor('/privacy')).toBe('/privacy')
    expect(pageFor('/privacy/')).toBe('/privacy')
    expect(pageFor('/privacy.html')).toBe('/privacy')
    expect(pageFor('/index.html')).toBe('/')
  })

  it('maps exported files to the URLs fetched at install', () => {
    const cases = { '/index.html': '/', '/privacy.html': '/privacy', '/404.html': '/404', '/docs/index.html': '/docs', '/privacy.txt': '/privacy.txt', '/_next/static/chunks/a.js': '/_next/static/chunks/a.js' }
    for (const [file, url] of Object.entries(cases))
      expect(urlForFile(file)).toBe(url)
  })

  it('caches only OK answers at install, plus the 404 page\'s own 404', () => {
    expect(acceptForPrecache('/privacy', 200)).toBe(true)
    expect(acceptForPrecache('/404', 404)).toBe(true)
    expect(acceptForPrecache('/404', 200)).toBe(true)
    expect(acceptForPrecache('/privacy', 404)).toBe(false)
    expect(acceptForPrecache('/', 500)).toBe(false)
  })
})
