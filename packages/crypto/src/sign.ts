import { sign, verify, etc, getPublicKey } from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'
import type { SignablePayload } from '@agentreceipts/schema'
import { canonicalize } from './canonical'

// Configure noble/ed25519 to use sha512 for sync operations.
// This is required by @noble/ed25519 v2 — without it, sync sign/verify throw.
etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array =>
  sha512(etc.concatBytes(...messages))

/**
 * Extract the signable fields from a full receipt object.
 * Maps receipt fields to the SignablePayload structure.
 *
 * NOTE: The API uses `timestamp` while the DB uses `created_at`.
 * This function expects the API format (timestamp).
 */
export function getSignablePayload(receipt: {
  receipt_id: string
  chain_id: string
  receipt_type: string
  agent_id: string
  org_id: string
  action: string
  input_hash: string
  output_hash: string | null
  status: string
  timestamp: string
  completed_at: string | null
  environment: string
  [key: string]: unknown
}): SignablePayload {
  return {
    receipt_id: receipt.receipt_id,
    chain_id: receipt.chain_id,
    receipt_type: receipt.receipt_type as SignablePayload['receipt_type'],
    agent_id: receipt.agent_id,
    org_id: receipt.org_id,
    action: receipt.action,
    input_hash: receipt.input_hash,
    output_hash: receipt.output_hash,
    status: receipt.status as SignablePayload['status'],
    timestamp: receipt.timestamp,
    completed_at: receipt.completed_at,
    environment: receipt.environment as SignablePayload['environment'],
  }
}

/**
 * Sign a receipt payload with Ed25519.
 *
 * @param payload - The signable fields (12 deterministic fields)
 * @param privateKey - Ed25519 private key as hex string (64 chars = 32 bytes)
 * @returns Signature string in format "ed25519:<base64>"
 */
export function signReceipt(
  payload: SignablePayload,
  privateKey: string
): string {
  const canonical = canonicalize(payload)
  const message = new TextEncoder().encode(canonical)
  const privKeyBytes = etc.hexToBytes(privateKey)
  const signature = sign(message, privKeyBytes)
  return `ed25519:${bytesToBase64(signature)}`
}

/**
 * Verify a receipt signature.
 *
 * @param payload - The signable fields (must match what was signed)
 * @param signature - Signature string in format "ed25519:<base64>"
 * @param publicKey - Ed25519 public key as hex string (64 chars = 32 bytes)
 * @returns true if signature is valid
 */
export function verifyReceipt(
  payload: SignablePayload,
  signature: string,
  publicKey: string
): boolean {
  try {
    if (!signature.startsWith('ed25519:')) {
      return false
    }
    const canonical = canonicalize(payload)
    const message = new TextEncoder().encode(canonical)
    const sigBytes = base64ToBytes(signature.slice('ed25519:'.length))
    const pubKeyBytes = etc.hexToBytes(publicKey)
    return verify(sigBytes, message, pubKeyBytes)
  } catch {
    return false
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}
