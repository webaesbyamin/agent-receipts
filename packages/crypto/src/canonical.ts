import type { SignablePayload } from '@agentreceipts/schema'

/**
 * Produce a canonical JSON string from a SignablePayload.
 * Keys are sorted alphabetically. Output is deterministic.
 *
 * IMPORTANT: SignablePayload contains only flat primitives (strings, nulls).
 * No nested objects or arrays. Simple key sorting is sufficient here.
 *
 * For hashing arbitrary user input/output (in the SDK), use deep canonical
 * sorting — that's a different function in the SDK package.
 */
export function canonicalize(payload: SignablePayload): string {
  const sorted = Object.keys(payload).sort()
  return JSON.stringify(payload, sorted)
}
