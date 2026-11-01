import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The runner tests watch real folders, start jobs and sign receipts; Windows CI runners are slow at that
    testTimeout: 30_000,
  },
})
