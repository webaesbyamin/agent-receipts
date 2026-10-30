// The page signature, shared by the build (scripts/build.mjs) and the test.
// The browser does the same steps in PAGE_SIGNATURE_JS (src/lib/scripts.ts):
// the text of every [data-signed] element, whitespace collapsed, joined with
// "\n" in DOM order, then SHA-256; the signature covers
// "agent-receipts-site:v1:<path>:<sha256 hex>".
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { parseHTML } from 'linkedom'

const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

export const normalize = (s) => s.replace(/\s+/g, ' ').trim()

/** The signed text of a rendered page, exactly as the browser collects it. */
export function signedText(html) {
  const { document } = parseHTML(html)
  const els = [...document.querySelectorAll('[data-signed]')]
  const nested = els.find((el) => el.parentElement?.closest('[data-signed]'))
  if (nested) throw new Error(`[data-signed] inside another [data-signed]: "${normalize(nested.textContent).slice(0, 60)}"`)
  if (!els.length) throw new Error('no [data-signed] elements on the page')
  return els.map((el) => normalize(el.textContent)).join('\n')
}

export const sha256Hex = (text) => createHash('sha256').update(text, 'utf-8').digest('hex')
export const message = (path, hash) => `agent-receipts-site:v1:${path}:${hash}`

export function publicKeyFromSeed(seedHex) {
  const key = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, Buffer.from(seedHex, 'hex')]), format: 'der', type: 'pkcs8' })
  return createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex')
}

export function signMessage(seedHex, msg) {
  const key = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, Buffer.from(seedHex, 'hex')]), format: 'der', type: 'pkcs8' })
  return sign(null, Buffer.from(msg, 'utf-8'), key).toString('hex')
}

export function verifyMessage(publicKeyHex, msg, signatureHex) {
  const key = createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]), format: 'der', type: 'spki' })
  return verify(null, Buffer.from(msg, 'utf-8'), key, Buffer.from(signatureHex, 'hex'))
}

/** The signature block the page embeds (src/generated/signature.json), read back from built HTML. */
export function embeddedSignature(html) {
  const { document } = parseHTML(html)
  const el = document.getElementById('page-signature')
  if (!el) throw new Error('no #page-signature on the page')
  return JSON.parse(el.textContent)
}
