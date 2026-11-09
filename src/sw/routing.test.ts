import { describe, expect, it } from 'vitest'
import { pageFor, routeFor } from './routing'

const origin = 'https://todo.anthonyugwuja.dev'
const precached = new Set(['/index.html', '/privacy.html', '/terms.html', '/404.html', '/_next/static/chunks/app.js', '/icon.png', '/privacy.txt'])
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
    expect(routeFor(get(`${origin}/?filter=overdue&sort=due`, 'navigate'), origin, precached)).toEqual({ kind: 'precache', key: '/index.html' })
    expect(routeFor(get(`${origin}/privacy`, 'navigate'), origin, precached)).toEqual({ kind: 'precache', key: '/privacy.html' })
    expect(routeFor(get(`${origin}/terms/`, 'navigate'), origin, precached)).toEqual({ kind: 'precache', key: '/terms.html' })
  })

  it('serves the 404 page for an unknown page, so offline never shows the browser\'s error', () => {
    expect(routeFor(get(`${origin}/no-such-page`, 'navigate'), origin, precached)).toEqual({ kind: 'precache', key: '/404.html' })
  })

  it('serves precached files, and lets anything else same-origin go to the network', () => {
    expect(routeFor(get(`${origin}/_next/static/chunks/app.js`), origin, precached)).toEqual({ kind: 'precache', key: '/_next/static/chunks/app.js' })
    expect(routeFor(get(`${origin}/privacy.txt?_rsc=abc`), origin, precached)).toEqual({ kind: 'precache', key: '/privacy.txt' })
    expect(routeFor(get(`${origin}/something-new.js`), origin, precached)).toEqual({ kind: 'network' })
  })

  it('maps page paths to the exported files', () => {
    expect(pageFor('/')).toBe('/index.html')
    expect(pageFor('/privacy')).toBe('/privacy.html')
    expect(pageFor('/privacy/')).toBe('/privacy.html')
    expect(pageFor('/index.html')).toBe('/index.html')
  })
})
