// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildServiceWorker, urlForFile as scriptUrlForFile } from '../../scripts/build-sw.mjs'
import { urlForFile } from './routing'

const dirs: string[] = []
async function exportDir(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), 'sw-test-'))
  dirs.push(dir)
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(dir, path, '..'), { recursive: true })
    await writeFile(join(dir, path), content)
  }
  return dir
}

afterEach(async () => {
  for (const dir of dirs.splice(0))
    await rm(dir, { recursive: true, force: true })
})

describe('building the service worker from the export', () => {
  it('precaches every exported file by the URL Vercel serves, but not itself or Next\'s not-found route', async () => {
    const outDir = await exportDir({ 'index.html': '<p>home</p>', 'privacy.html': 'p', '404.html': 'nf', '_not-found.html': 'nf', '_next/static/chunks/a.js': 'a', 'icons/icon-192.png': 'png', 'sw.js': 'old' })
    const { count } = await buildServiceWorker({ outDir })
    const sw = await readFile(join(outDir, 'sw.js'), 'utf8')
    expect(count).toBe(5)
    for (const path of ['/', '/privacy', '/404', '/_next/static/chunks/a.js', '/icons/icon-192.png'])
      expect(sw).toContain(`"${path}"`)
    for (const path of ['/sw.js', '/index.html', '/privacy.html', '/_not-found'])
      expect(sw).not.toContain(`"${path}"`)
  })

  it('changes version when any file changes, and only then', async () => {
    const files = { 'index.html': 'v1', '_next/static/chunks/a.js': 'a' }
    const first = await buildServiceWorker({ outDir: await exportDir(files) })
    const same = await buildServiceWorker({ outDir: await exportDir(files) })
    const changed = await buildServiceWorker({ outDir: await exportDir({ ...files, 'index.html': 'v2' }) })
    expect(same.version).toBe(first.version)
    expect(changed.version).not.toBe(first.version)
  })

  it('maps files to URLs exactly as the worker\'s routing does', () => {
    for (const file of ['/index.html', '/privacy.html', '/404.html', '/docs/index.html', '/privacy.txt', '/_next/static/chunks/a.js'])
      expect(scriptUrlForFile(file)).toBe(urlForFile(file))
  })
})
