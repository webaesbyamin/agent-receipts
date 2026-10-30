// One time only: make the site's own Ed25519 signing key (not the Webaes
// Magic Folder key). The private key goes straight from memory into Vercel
// (SITE_SIGNING_KEY, sensitive, production + preview) and the macOS Keychain,
// so it can be moved to a password manager. It is never printed or written to
// disk. The public key is written to public/.well-known/agent-receipts-site.json.
import { generateKeyPairSync } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeKeyId } from '@agent-receipts/crypto'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', '.well-known', 'agent-receipts-site.json')
const SERVICE = 'agent-receipts-site-signing-key'
if (existsSync(out)) throw new Error(`${out} exists: the site key was made already`)

const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('hex')
const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex')
const keyId = computeKeyId(pub)

const vercel = spawnSync('vercel', ['env', 'add', 'SITE_SIGNING_KEY', 'production,preview', '--sensitive', '--yes',
  '--project', 'agent-receipts-site', '--scope', 'modquote-production'], { input: seed, encoding: 'utf-8' })
if (vercel.status !== 0) throw new Error(`vercel env add failed:\n${vercel.stderr.replaceAll(seed, '[key]')}`)

// `security -i` reads the command from stdin, so the key never appears in a process list
const keychain = spawnSync('security', ['-i'], {
  input: `add-generic-password -U -a ${keyId} -s ${SERVICE} -l "Agent Receipts site signing key" -w ${seed}\n`, encoding: 'utf-8',
})
if (keychain.status !== 0 || /error/i.test(keychain.stderr)) throw new Error('Keychain save failed (the key is in Vercel only)')

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({
  key_id: keyId,
  public_key: pub,
  algorithm: 'Ed25519',
  purpose: 'site',
  issuer: 'Agent Receipts by Webaes',
  url: 'https://receipts.webaes.com',
  message: 'agent-receipts-site:v1:<path>:<sha256 hex of the page text>',
}, null, 2) + '\n')
console.log(`site key ${keyId}: added to Vercel (production, preview) and to the Keychain item "${SERVICE}"; public key written to public/.well-known/agent-receipts-site.json`)
