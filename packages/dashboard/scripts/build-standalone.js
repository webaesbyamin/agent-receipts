#!/usr/bin/env node

/**
 * Build script for @agent-receipts/dashboard
 *
 * 1. Builds the Next.js app in standalone mode
 * 2. Copies the standalone output to packages/dashboard/standalone/
 * 3. Compiles the CLI entry point
 */

const { execSync } = require('child_process')
const { cpSync, rmSync, mkdirSync, existsSync, readdirSync, statSync, lstatSync, realpathSync, copyFileSync, chmodSync, readFileSync } = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const WEB_DIR = path.join(ROOT, 'apps/web')
const DASHBOARD_DIR = path.join(ROOT, 'packages/dashboard')
const STANDALONE_DIR = path.join(DASHBOARD_DIR, 'standalone')

console.log('Building @agent-receipts/dashboard...\n')

// Step 1: Build Next.js app
// apps/web/.env.production turns demo mode on for the hosted Vercel demo.
// The npm dashboard must show the user's own receipts, so force demo mode off
// here: process env wins over .env files, and NEXT_PUBLIC_* is inlined at
// build time, so this is the only place it can be set for the client bundle.
console.log('1. Building Next.js app (standalone mode, demo mode off)...')
execSync('pnpm build', {
  cwd: WEB_DIR,
  stdio: 'inherit',
  env: { ...process.env, DEMO_MODE: 'false', NEXT_PUBLIC_DEMO_MODE: 'false' },
})

// Step 2: Clean previous standalone output
if (existsSync(STANDALONE_DIR)) {
  rmSync(STANDALONE_DIR, { recursive: true })
}
mkdirSync(STANDALONE_DIR, { recursive: true })

// Step 3: Copy standalone output with a flat node_modules
// Next traces pnpm's layout: packages live in node_modules/.pnpm/<pkg>/node_modules/<name>
// and are found through symlinks, which npm tarballs drop. Copying the links
// as folders doesn't work either (a package's deps are its .pnpm siblings).
// So build a hoisted layout: every package at standalone/node_modules/<name>.
function copyDereferenced(src, dest, seen = new Set()) {
  const real = realpathSync(src)
  if (seen.has(real)) throw new Error(`Symlink cycle at ${src}`)
  const st = statSync(src)
  if (!st.isDirectory()) {
    copyFileSync(src, dest)
    chmodSync(dest, st.mode)
    return
  }
  mkdirSync(dest, { recursive: true })
  seen.add(real)
  for (const name of readdirSync(src)) copyDereferenced(path.join(src, name), path.join(dest, name), seen)
  seen.delete(real)
}
const standaloneSource = path.join(WEB_DIR, '.next/standalone')
console.log('2. Copying standalone output (flattening node_modules)...')
// App files: everything except node_modules folders
function copyApp(src, dest) {
  mkdirSync(dest, { recursive: true })
  for (const name of readdirSync(src)) {
    if (name === 'node_modules') continue
    const from = path.join(src, name)
    if (statSync(from).isDirectory()) copyApp(from, path.join(dest, name))
    else copyDereferenced(from, path.join(dest, name))
  }
}
copyApp(standaloneSource, STANDALONE_DIR)
// Packages: each real package folder inside .pnpm/<pkg>/node_modules (the
// symlinks there point at its dependencies, which are listed on their own)
const pnpmDir = path.join(standaloneSource, 'node_modules/.pnpm')
const hoisted = new Map()
function hoist(name, from) {
  const version = JSON.parse(readFileSync(path.join(from, 'package.json'), 'utf8')).version
  if (hoisted.has(name)) {
    if (hoisted.get(name) === version) return
    console.error(`\nTwo versions of ${name} (${hoisted.get(name)} and ${version}); a flat node_modules can't hold both.`)
    process.exit(1)
  }
  hoisted.set(name, version)
  copyDereferenced(from, path.join(STANDALONE_DIR, 'node_modules', name))
}
for (const entry of existsSync(pnpmDir) ? readdirSync(pnpmDir) : []) {
  const nm = path.join(pnpmDir, entry, 'node_modules')
  if (!existsSync(nm)) continue
  for (const name of readdirSync(nm)) {
    const names = name.startsWith('@') ? readdirSync(path.join(nm, name)).map((n) => `${name}/${n}`) : [name]
    for (const full of names) {
      if (!lstatSync(path.join(nm, full)).isSymbolicLink()) hoist(full, path.join(nm, full))
    }
  }
}
console.log(`   ${hoisted.size} packages`)

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

// Step 5b: Never ship .env files (Next copies them into standalone output,
// and the server would load DEMO_MODE=true from .env.production at runtime)
function removeEnvFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) removeEnvFiles(full)
    else if (name === '.env' || name.startsWith('.env.')) {
      rmSync(full)
      console.log(`   removed ${path.relative(STANDALONE_DIR, full)}`)
    }
  }
}
removeEnvFiles(STANDALONE_DIR)

// Step 5c: Never bundle platform-specific native packages built on this machine.
// better-sqlite3 comes from the dashboard's own dependency (right binary per
// user). sharp/@img are only for next/image, which the app doesn't use
// (images.unoptimized in next.config.ts).
const NATIVE = ['better-sqlite3', 'sharp', '@img']
function removeNative(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (!lstatSync(full).isDirectory()) continue
    if (NATIVE.includes(name)) {
      rmSync(full, { recursive: true })
      console.log(`   removed ${path.relative(STANDALONE_DIR, full)}`)
    } else {
      removeNative(full)
    }
  }
}
removeNative(path.join(STANDALONE_DIR, 'node_modules'))

// Step 5d: Fail if any symlink is left; npm would silently drop it.
function findSymlinks(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = lstatSync(full)
    if (st.isSymbolicLink()) found.push(path.relative(STANDALONE_DIR, full))
    else if (st.isDirectory()) findSymlinks(full, found)
  }
  return found
}
const symlinks = findSymlinks(STANDALONE_DIR)
if (symlinks.length) {
  console.error(`\nSymlinks left in standalone/ (npm would drop them):\n  ${symlinks.slice(0, 20).join('\n  ')}`)
  process.exit(1)
}

// Step 5e: Fail if anything only for the hosted demo made it into the local
// dashboard: web analytics (the demo counts page views; a dashboard on
// someone's own machine must not) or the demo's search/sharing metadata.
const DEMO_ONLY = ['_vercel/insights', 'Live Demo | Agent Receipts Dashboard', 'demo.receipts.webaes.com/sitemap.xml']
function findInsights(dir, found = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const full = path.join(dir, name)
    const st = lstatSync(full)
    if (st.isDirectory()) findInsights(full, found)
    else if (st.isFile() && DEMO_ONLY.some((s) => readFileSync(full).includes(s))) found.push(path.relative(STANDALONE_DIR, full))
  }
  return found
}
const insights = findInsights(STANDALONE_DIR)
if (insights.length) {
  console.error(`\nHosted-demo code (${DEMO_ONLY.join(', ')}) found in standalone/, outside node_modules:\n  ${insights.slice(0, 20).join('\n  ')}`)
  process.exit(1)
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
