import { z } from 'zod'
import { ReceiptStatus, ReceiptType, Environment } from './enums'

/**
 * The 12 fields that are cryptographically signed.
 * These fields are extracted from a receipt and serialized as canonical JSON
 * before signing with Ed25519.
 */
export const SignablePayload = z.object({
  receipt_id: z.string(),
  chain_id: z.string(),
  receipt_type: ReceiptType,
  agent_id: z.string(),
  org_id: z.string(),
  action: z.string(),
  input_hash: z.string(),
  output_hash: z.string().nullable(),
  status: ReceiptStatus,
  timestamp: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
  environment: Environment,
})
export type SignablePayload = z.infer<typeof SignablePayload>

/**
 * The complete receipt object as returned by the API.
 */
export const ActionReceipt = z.object({
  // Identity
  receipt_id: z.string(),
  parent_receipt_id: z.string().nullable(),
  chain_id: z.string(),

  // Type
  receipt_type: ReceiptType,

  // Who
  agent_id: z.string(),
  org_id: z.string(),

  // What
  action: z.string(),
  input_hash: z.string(),
  output_hash: z.string().nullable(),
  output_summary: z.string().nullable(),

  // How (all nullable — may not be known at creation)
  model: z.string().nullable(),
  tokens_in: z.number().int().nonnegative().nullable(),
  tokens_out: z.number().int().nonnegative().nullable(),
  cost_usd: z.number().nonnegative().nullable(),
  latency_ms: z.number().int().nonnegative().nullable(),
  tool_calls: z.array(z.string()).nullable(),

  // When
  timestamp: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),

  // Status
  status: ReceiptStatus,
  error: z.record(z.unknown()).nullable(),

  // Context
  environment: Environment,
  tags: z.array(z.string()).nullable(),

  // Verification (Tier 2 — Phase 6)
  constraints: z.record(z.unknown()).nullable(),
  constraint_result: z.record(z.unknown()).nullable(),

  // Trust
  signature: z.string(),
  verify_url: z.string().url(),

  // Optional
  callback_verified: z.boolean().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  metadata: z.record(z.unknown()),
})
export type ActionReceipt = z.infer<typeof ActionReceipt>
