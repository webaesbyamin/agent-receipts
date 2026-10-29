#!/usr/bin/env node
// CI only: start a throwaway npm registry (Verdaccio) on 127.0.0.1:4873,
// publish the packed tarballs to it, and point npm at it. Lets the install
// guide's exact `npm install -g …` command run against unreleased code.
//   node scripts/ci/local-registry.mjs <dir with *.tgz>
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readdirSync, appendFileSync, openSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const tarballs = resolve(process.argv[2] ?? 'tarballs')
const home = join(process.env.RUNNER_TEMP ?? tmpdir(), 'verdaccio')
mkdirSync(home, { recursive: true })
const config = join(home, 'config.yaml')
writeFileSync(config, `storage: ./storage
auth:
  htpasswd:
    file: ./htpasswd
    max_users: 10
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@agent-receipts/*':
    access: $all
    publish: $authenticated
  '**':
    access: $all
    proxy: npmjs
log: { type: stdout, format: pretty, level: warn }
`)

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const log = openSync(join(home, 'verdaccio.log'), 'a')
const child = spawn(npx, ['--yes', 'verdaccio@6', '--config', config, '--listen', '127.0.0.1:4873'], {
  detached: true, stdio: ['ignore', log, log], shell: process.platform === 'win32',
})
child.unref()

const registry = 'http://127.0.0.1:4873/'
for (let i = 0; ; i++) {
  try { if ((await fetch(registry + '-/ping')).ok) break } catch { /* not up yet */ }
  if (i > 120) throw new Error('Verdaccio did not start')
  await new Promise((r) => setTimeout(r, 1000))
}

const res = await fetch(registry + '-/user/org.couchdb.user:ci', {
  method: 'PUT', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'ci', password: 'ci-password', email: 'ci@example.com' }),
})
const { token } = await res.json()
if (!token) throw new Error(`Could not create a Verdaccio user (${res.status})`)
const npmrc = join(home, 'npmrc')
writeFileSync(npmrc, `registry=${registry}\n//127.0.0.1:4873/:_authToken=${token}\n`)

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
// Dependencies first, so each one is there when the next is published
const order = ['schema', 'crypto', 'mcp-server', 'magic-folder']
const files = readdirSync(tarballs).filter((f) => f.endsWith('.tgz'))
  .sort((a, b) => order.findIndex((o) => a.includes(`-${o}-`)) - order.findIndex((o) => b.includes(`-${o}-`)))
for (const f of files) {
  execFileSync(npm, ['publish', join(tarballs, f), '--registry', registry], {
    stdio: 'inherit', env: { ...process.env, NPM_CONFIG_USERCONFIG: npmrc }, shell: process.platform === 'win32',
  })
}

// Later steps install from here, with no other change to the guide's commands
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `NPM_CONFIG_USERCONFIG=${npmrc}\n`)
console.log(`Local registry ready with ${files.join(', ')}`)
