// `pnpm build` for the site. The home page signs its own text, so it's built
// twice: once to render the page, then again with the signature of what that
// render says. The page text doesn't depend on the signature, so the second
// render signs the same text; the last step checks that it does.
//
// The key is SITE_SIGNING_KEY (Vercel, production + preview). It must match
// public/.well-known/agent-receipts-site.json. Local builds without it sign
// with a throwaway test key, and the page says so.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeKeyId } from '@agent-receipts/crypto'
import { signedText, sha256Hex, message, publicKeyFromSeed, signMessage, verifyMessage, embeddedSignature } from './page-signature.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const next = createRequire(import.meta.url).resolve('next/dist/bin/next')
const run = (args) => {
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
const homeHtml = () => readFileSync(join(root, '.next', 'server', 'app', 'index.html'), 'utf-8')

const published = JSON.parse(readFileSync(join(root, 'public', '.well-known', 'agent-receipts-site.json'), 'utf-8'))
let seed = process.env.SITE_SIGNING_KEY?.trim()
let dev = false
if (seed) {
  if (!/^[0-9a-f]{64}$/.test(seed)) throw new Error('SITE_SIGNING_KEY is not a 64-character hex Ed25519 key')
  if (publicKeyFromSeed(seed) !== published.public_key) throw new Error(`SITE_SIGNING_KEY is not the key published as ${published.key_id}`)
} else if (process.env.VERCEL) {
  throw new Error('SITE_SIGNING_KEY is not set for this Vercel environment')
} else {
  seed = randomBytes(32).toString('hex')
  dev = true
  console.warn('SITE_SIGNING_KEY not set: signing with a throwaway test key (local build only)')
}
const publicKey = publicKeyFromSeed(seed)
const sigFile = join(root, 'src', 'generated', 'signature.json')

run(['scripts/generate.mjs'])
run([next, 'build'])

const text = signedText(homeHtml())
const hash = sha256Hex(text)
const block = { path: '/', sha256: hash, signature: signMessage(seed, message('/', hash)), key_id: computeKeyId(publicKey), public_key: publicKey, dev }
writeFileSync(sigFile, JSON.stringify(block, null, 2) + '\n')
seed = undefined

run([next, 'build'])

const html = homeHtml()
const embedded = embeddedSignature(html)
const again = sha256Hex(signedText(html))
if (again !== hash) throw new Error('the page text changed between the two builds')
if (!verifyMessage(embedded.public_key, message('/', again), embedded.signature)) throw new Error('the built page does not verify')
console.log(`page signature: ${block.key_id}${dev ? ' (test key)' : ''}, sha256 ${hash.slice(0, 16)}…, ${text.split('\n').length} signed elements, verified`)
