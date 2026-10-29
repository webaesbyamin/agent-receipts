import { sign, verify, etc } from '@noble/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import { sha512 } from '@noble/hashes/sha512'
import { canonicalize } from './canonical'
import { getSignablePayload } from './sign'

// noble/ed25519 v2 needs a sync sha512 for sign/verify (also set in sign.ts;
// repeated here so this module works when imported on its own).
etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array =>
  sha512(etc.concatBytes(...messages))

/** Fields never covered by a v2 signature. */
export const V2_UNSIGNED_FIELDS = ['signature', 'verify_url'] as const

/**
 * Deep canonical JSON: keys sorted at every depth, arrays kept in order,
 * `undefined` object values dropped (as JSON.stringify does).
 *
 * The browser verifier (receipt.html, verify page) re-implements exactly this
 * function, so keep the two in sync.
 */
export function canonicalizeDeep(value: unknown): string {
  return JSON.stringify(sortDeep(value)) ?? 'null'
}

function sortDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortDeep)
  // Null-prototype object: a "__proto__" key stays an ordinary key (and so is
  // signed) instead of silently becoming the prototype and vanishing.
  const out: Record<string, unknown> = Object.create(null)
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const v = (value as Record<string, unknown>)[key]
    if (v !== undefined) out[key] = sortDeep(v)
  }
  return out
}

/** Everything in the receipt except the signature and verify_url. */
export function getSignablePayloadV2(receipt: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = Object.create(null)
  for (const [key, value] of Object.entries(receipt)) {
    if ((V2_UNSIGNED_FIELDS as readonly string[]).includes(key)) continue
    if (value !== undefined) out[key] = value
  }
  return out
}

/** Sign a v2 receipt. The receipt must already carry `sig_version: 2`. */
export function signReceiptV2(receipt: Record<string, unknown>, privateKey: string): string {
  if (receipt['sig_version'] !== 2) {
    throw new Error('signReceiptV2: receipt.sig_version must be 2')
  }
  const message = new TextEncoder().encode(canonicalizeDeep(getSignablePayloadV2(receipt)))
  const sig = sign(message, etc.hexToBytes(privateKey))
  return `ed25519:${Buffer.from(sig).toString('base64')}`
}

/** Verify a v2 signature. Returns false for anything that isn't a valid v2 receipt. */
export function verifyReceiptV2(receipt: Record<string, unknown>, publicKey: string): boolean {
  try {
    const signature = receipt['signature']
    if (receipt['sig_version'] !== 2 || typeof signature !== 'string') return false
    if (!signature.startsWith('ed25519:')) return false
    const message = new TextEncoder().encode(canonicalizeDeep(getSignablePayloadV2(receipt)))
    const sigBytes = new Uint8Array(Buffer.from(signature.slice('ed25519:'.length), 'base64'))
    return verify(sigBytes, message, etc.hexToBytes(publicKey))
  } catch {
    return false
  }
}

export interface VerifyResult {
  valid: boolean
  sig_version: 1 | 2
  /** True when the signature covers every field (v2). v1 covers 12 fields only. */
  covers_all_fields: boolean
  key_id_matches: boolean | null
}

/**
 * Verify any receipt, v1 or v2.
 *
 * A v1 receipt only signs 12 core fields: its summary, cost, files and
 * metadata can be edited without breaking the signature. Verifiers that show
 * those fields to people must pass `{ requireV2: true }` (stripping
 * `sig_version` from a v2 receipt does not help an attacker: v1 signs
 * different bytes, so it fails either way).
 */
export function verifyAnyReceipt(
  receipt: Record<string, unknown>,
  publicKey: string,
  options: { requireV2?: boolean } = {},
): VerifyResult {
  if (receipt['sig_version'] === 2) {
    const keyId = receipt['key_id']
    return {
      valid: verifyReceiptV2(receipt, publicKey),
      sig_version: 2,
      covers_all_fields: true,
      key_id_matches: typeof keyId === 'string' ? keyId === computeKeyId(publicKey) : null,
    }
  }
  if (options.requireV2) {
    return { valid: false, sig_version: 1, covers_all_fields: false, key_id_matches: null }
  }
  let valid = false
  try {
    const signable = getSignablePayload(receipt as Parameters<typeof getSignablePayload>[0])
    const signature = String(receipt['signature'] ?? '')
    if (signature.startsWith('ed25519:')) {
      const message = new TextEncoder().encode(canonicalize(signable))
      const sigBytes = new Uint8Array(Buffer.from(signature.slice('ed25519:'.length), 'base64'))
      valid = verify(sigBytes, message, etc.hexToBytes(publicKey))
    }
  } catch {
    valid = false
  }
  return { valid, sig_version: 1, covers_all_fields: false, key_id_matches: null }
}

/** Short, stable name for a public key: `key_` + first 16 hex of sha256(raw key bytes). */
export function computeKeyId(publicKeyHex: string): string {
  return `key_${etc.bytesToHex(sha256(etc.hexToBytes(publicKeyHex))).slice(0, 16)}`
}

/** Hash of a whole stored receipt (signature included) — what the next receipt in a chain links to. */
export function hashReceipt(receipt: Record<string, unknown>): string {
  const bytes = new TextEncoder().encode(canonicalizeDeep(receipt))
  return `sha256:${etc.bytesToHex(sha256(bytes))}`
}
