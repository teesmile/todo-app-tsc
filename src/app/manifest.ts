import type { MetadataRoute } from 'next'

// Built into out/manifest.webmanifest by the static export.
export const dynamic = 'force-static'

/**
 * The web app manifest (Phase 11): installable as "Todo App", opening
 * full-screen at the home page. Maskable icons are full-bleed (the logo on
 * its own gradient), so Android's mask shapes never cut into it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Todo App',
    short_name: 'Todo App',
    description: 'A task list that keeps your tasks on your device, offline too.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#f9fafb',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
