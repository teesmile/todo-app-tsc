// Serves the static export (out/) for local checks, as the host does: a
// path maps to its file, `/privacy` to privacy.html, and anything unknown to
// 404.html. `pnpm start` runs it; `next start` can't serve a static export.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import process from 'node:process'

const root = join(process.cwd(), 'out')
const port = Number(process.env.PORT ?? 3000)
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }

async function isFile(path) {
  try {
    return (await stat(path)).isFile()
  }
  catch {
    return false
  }
}

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const candidates = safe === '/' ? ['/index.html'] : [safe, `${safe.replace(/\/$/, '')}.html`, join(safe, 'index.html')]
  let file = null
  for (const candidate of candidates) {
    if (await isFile(join(root, candidate))) {
      file = join(root, candidate)
      break
    }
  }
  const status = file ? 200 : 404
  file ??= join(root, '404.html')
  response.writeHead(status, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    // The service worker must always be re-checked, so updates are found.
    'Cache-Control': file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=0, must-revalidate',
  })
  createReadStream(file).pipe(response)
}).listen(port, () => console.log(`Serving out/ at http://localhost:${port}`))
