import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.idb.ts', './vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Database tests need Docker; they run with `pnpm test:db`.
    exclude: [...configDefaults.exclude, 'src/**/*.db.test.ts'],
  },
})
