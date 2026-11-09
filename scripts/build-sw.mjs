// Builds out/sw.js after `next build` (Phase 11): lists every file the static
// export emitted, derives a version from their paths and contents, and
// bundles src/sw/sw.ts with both filled in. Nothing is maintained by hand: a
// new or changed file changes the list and the version, so the next visit
// installs a new worker and the page offers "Update available".
import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

/** Same rule as urlForFile in src/sw/routing.ts (a test keeps them in step): pages by their clean URL. */
export function urlForFile(path) {
  if (!path.endsWith('.html'))
    return path
  const page = path.slice(0, -'.html'.length).replace(/(^|\/)index$/, '')
  return page === '' ? '/' : page
}

async function filesUnder(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      out.push(...await filesUnder(path))
    else if (entry.isFile())
      out.push(path)
  }
  return out
}

export async function buildServiceWorker({ outDir = 'out', entry = 'src/sw/sw.ts' } = {}) {
  const files = (await filesUnder(outDir))
    .map(path => ({ path, url: `/${relative(outDir, path).split(sep).join('/')}` }))
    .filter(({ url }) => url !== '/sw.js')
    // Next's own not-found route; /404 is the page a browser gets.
    .filter(({ url }) => url !== '/_not-found.html')
    .sort((a, b) => a.url.localeCompare(b.url))
  const hash = createHash('sha256')
  for (const { path, url } of files) {
    hash.update(url)
    hash.update(createHash('sha256').update(await readFile(path)).digest())
  }
  const version = hash.digest('hex').slice(0, 16)
  // Fetched at install by the URL Vercel serves, not the filename.
  const precache = files.map(f => urlForFile(f.url))
  const outfile = join(outDir, 'sw.js')
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    minify: true,
    target: 'es2020',
    define: { __PRECACHE__: JSON.stringify(precache), __VERSION__: JSON.stringify(version) },
    outfile,
    logLevel: 'silent',
  })
  const bytes = files.length ? (await Promise.all(files.map(f => stat(f.path)))).reduce((sum, s) => sum + s.size, 0) : 0
  return { version, count: precache.length, bytes, outfile }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { version, count, bytes, outfile } = await buildServiceWorker()
  console.log(`service worker: ${outfile}, version ${version}, precaching ${count} files (${(bytes / 1024 / 1024).toFixed(1)} MB)`)
}
