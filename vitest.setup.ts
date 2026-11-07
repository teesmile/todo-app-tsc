import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Testing Library only auto-cleans when Vitest globals are on; they're off here.
afterEach(() => {
  cleanup()
})
