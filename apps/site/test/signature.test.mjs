// The built home page verifies against its own embedded signature, and stops
// verifying when one character of its signed text changes. Runs on the output
// of `pnpm build` (turbo runs build before test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { signedText, sha256Hex, message, verifyMessage, embeddedSignature } from '../scripts/page-signature.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const html = readFileSync(join(root, '.next', 'server', 'app', 'index.html'), 'utf-8')
const sig = embeddedSignature(html)
const published = JSON.parse(readFileSync(join(root, 'public', '.well-known', 'agent-receipts-site.json'), 'utf-8'))
const check = (text) => verifyMessage(sig.public_key, message(sig.path, sha256Hex(text)), sig.signature)

test('the built page verifies against its embedded signature', () => {
  const text = signedText(html)
  assert.ok(text.split('\n').length > 40, 'expected the page to sign many elements')
  assert.equal(sha256Hex(text), sig.sha256)
  assert.equal(check(text), true)
})

test('one changed character breaks it', () => {
  const text = signedText(html)
  const i = text.indexOf('Prove it.')
  assert.ok(i > 0)
  assert.equal(check(text.slice(0, i) + 'Prove it!' + text.slice(i + 9)), false)
})

test('one changed character in the HTML breaks it too', () => {
  const edited = html.replace('What a receipt records.', 'What a receipt records!')
  assert.notEqual(edited, html)
  assert.equal(check(signedText(edited)), false)
})

test('the key is the published site key (or a marked local test key)', () => {
  if (sig.dev) assert.notEqual(sig.public_key, published.public_key)
  else {
    assert.equal(sig.public_key, published.public_key)
    assert.equal(sig.key_id, published.key_id)
  }
  assert.equal(published.purpose, 'site')
})
