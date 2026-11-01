import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The CLI tests start real processes (the CLI, the hook, MCP servers); Windows CI runners are slow at that
    testTimeout: 30_000,
  },
})
