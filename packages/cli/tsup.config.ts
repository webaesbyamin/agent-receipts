import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    clean: true,
    sourcemap: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    // The Claude Code hook: one self-contained file, so it loads fast and
    // keeps working wherever it is copied
    entry: { 'agent-receipts-claude-code-hook': 'src/hooks/hook-entry.ts' },
    format: ['esm'],
    outExtension: () => ({ js: '.mjs' }),
    clean: false,
    platform: 'node',
    target: 'node22',
    noExternal: [/.*/],
    minify: true,
    // Some bundled dependencies still call require(); give the ESM bundle one
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  },
  {
    // For scripts/sync-plugin.mjs: the plugin's hooks.json comes from the same code as `hooks install`
    entry: { 'plugin-hooks': 'src/hooks/settings.ts' },
    format: ['esm'],
    outExtension: () => ({ js: '.mjs' }),
    clean: false,
    platform: 'node',
  },
])
