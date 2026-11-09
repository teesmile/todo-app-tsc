import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Decision 2: the app is static files (out/). There is no server of our
  // own: auth and sync go from the browser to Supabase. Phase 11's service
  // worker precaches exactly what this emits.
  output: 'export',
  // With no server there is no image optimizer: icons are served as they are.
  images: { unoptimized: true },
}

export default nextConfig
