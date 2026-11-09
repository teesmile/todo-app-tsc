// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildServiceWorker } from '../../scripts/build-sw.mjs'

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
  it('precaches every exported file, but not itself', async () => {
    const outDir = await exportDir({ 'index.html': '<p>home</p>', 'privacy.html': 'p', '_next/static/chunks/a.js': 'a', 'icons/icon-192.png': 'png', 'sw.js': 'old' })
    const { count } = await buildServiceWorker({ outDir })
    const sw = await readFile(join(outDir, 'sw.js'), 'utf8')
    expect(count).toBe(4)
    for (const path of ['/index.html', '/privacy.html', '/_next/static/chunks/a.js', '/icons/icon-192.png'])
      expect(sw).toContain(`"${path}"`)
    expect(sw).not.toContain('"/sw.js"')
  })

  it('changes version when any file changes, and only then', async () => {
    const files = { 'index.html': 'v1', '_next/static/chunks/a.js': 'a' }
    const first = await buildServiceWorker({ outDir: await exportDir(files) })
    const same = await buildServiceWorker({ outDir: await exportDir(files) })
    const changed = await buildServiceWorker({ outDir: await exportDir({ ...files, 'index.html': 'v2' }) })
    expect(same.version).toBe(first.version)
    expect(changed.version).not.toBe(first.version)
  })
})
