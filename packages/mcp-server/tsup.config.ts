import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  {
    entry: ['src/server.ts'],
    format: ['esm'],
    clean: false,
    sourcemap: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
])
