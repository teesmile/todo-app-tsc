import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// `pnpm test:db`: tests against the local Supabase stack (Docker), kept apart
// from `pnpm test` so the everyday gate needs no Docker.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.db.test.ts'],
    // Dexie (the sync tests' devices) needs IndexedDB before it loads.
    setupFiles: ['./vitest.idb.ts'],
    globalSetup: ['./vitest.db.setup.ts'],
    testTimeout: 20_000,
  },
})
