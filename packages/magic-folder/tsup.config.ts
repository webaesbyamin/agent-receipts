import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['@anthropic-ai/claude-agent-sdk'],
  },
  {
    entry: ['src/cli.ts'],
    format: ['cjs'],
    clean: false,
    sourcemap: true,
    external: ['@anthropic-ai/claude-agent-sdk'],
    banner: { js: '#!/usr/bin/env node' },
  },
])
