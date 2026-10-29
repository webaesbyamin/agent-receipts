#!/usr/bin/env node
// Keeps the hand-pinned versions in step with @agent-receipts/mcp-server:
// the MCP server's reported version, server.json (MCP Registry) and the
// Dockerfile that Glama builds. Runs after `changeset version`.
//   node scripts/sync-versions.mjs          update the files
//   node scripts/sync-versions.mjs --check  exit 1 if anything is out of step
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const version = JSON.parse(readFileSync(join(root, 'packages/mcp-server/package.json'), 'utf8')).version
const check = process.argv.includes('--check')

const targets = [
  ['packages/mcp-server/src/server.ts', (s) => s.replace(/(name: 'agent-receipts',\s*version: ')[^']+(')/, `$1${version}$2`)],
  ['server.json', (s) => {
    const j = JSON.parse(s)
    j.version = version
    for (const p of j.packages ?? []) if (p.identifier === '@agent-receipts/mcp-server') p.version = version
    return JSON.stringify(j, null, 2) + '\n'
  }],
  ['Dockerfile', (s) => s.replace(/@agent-receipts\/mcp-server@[0-9][^\s]*/, `@agent-receipts/mcp-server@${version}`)],
]

let stale = 0
for (const [file, update] of targets) {
  const path = join(root, file)
  const before = readFileSync(path, 'utf8')
  const after = update(before)
  if (after === before) continue
  stale++
  if (check) console.error(`${file} is not at ${version}`)
  else { writeFileSync(path, after); console.log(`${file} -> ${version}`) }
}
if (check && stale) process.exit(1)
if (!stale) console.log(`All pinned versions at ${version}`)
