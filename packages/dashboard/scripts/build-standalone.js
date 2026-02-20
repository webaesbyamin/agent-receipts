#!/usr/bin/env node

/**
 * Build script for @agent-receipts/dashboard
 *
 * 1. Builds the Next.js app in standalone mode
 * 2. Copies the standalone output to packages/dashboard/standalone/
 * 3. Compiles the CLI entry point
 */

const { execSync } = require('child_process')
const { cpSync, rmSync, mkdirSync, existsSync } = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const WEB_DIR = path.join(ROOT, 'apps/web')
const DASHBOARD_DIR = path.join(ROOT, 'packages/dashboard')
const STANDALONE_DIR = path.join(DASHBOARD_DIR, 'standalone')

console.log('Building @agent-receipts/dashboard...\n')

// Step 1: Build Next.js app
console.log('1. Building Next.js app (standalone mode)...')
execSync('pnpm build', { cwd: WEB_DIR, stdio: 'inherit' })

// Step 2: Clean previous standalone output
if (existsSync(STANDALONE_DIR)) {
  rmSync(STANDALONE_DIR, { recursive: true })
}
mkdirSync(STANDALONE_DIR, { recursive: true })

// Step 3: Copy standalone output
const standaloneSource = path.join(WEB_DIR, '.next/standalone')
console.log('2. Copying standalone output...')
cpSync(standaloneSource, STANDALONE_DIR, { recursive: true })

// Step 4: Copy static assets (required for standalone mode)
const staticSource = path.join(WEB_DIR, '.next/static')
const staticDest = path.join(STANDALONE_DIR, 'apps/web/.next/static')
if (existsSync(staticSource)) {
  console.log('3. Copying static assets...')
  cpSync(staticSource, staticDest, { recursive: true })
}

// Step 5: Copy public directory (if exists)
const publicSource = path.join(WEB_DIR, 'public')
const publicDest = path.join(STANDALONE_DIR, 'apps/web/public')
if (existsSync(publicSource)) {
  console.log('4. Copying public assets...')
  cpSync(publicSource, publicDest, { recursive: true })
}

// Step 6: Compile CLI
console.log('5. Compiling CLI...')
execSync('npx tsup src/cli.ts --format cjs --out-dir dist --clean', {
  cwd: DASHBOARD_DIR,
  stdio: 'inherit'
})

console.log('\nBuild complete!')
console.log(`  Standalone: ${STANDALONE_DIR}`)
console.log(`  CLI: ${path.join(DASHBOARD_DIR, 'dist/cli.js')}`)
