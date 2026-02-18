import { z } from 'zod'
import { ReceiptStatus, ReceiptType, Environment, ErrorCode } from './enums'

/**
 * What the client sends to POST /api/v1/receipts.
 */
export const CreateReceiptInput = z.object({
  // Required
  agent_id: z.string().min(1),
  action: z.string().min(1),
  input_hash: z.string().min(1),

  // Optional with defaults
  receipt_type: ReceiptType.default('action'),
  status: ReceiptStatus.default('pending'),
  environment: Environment.default('production'),

  // Optional
  parent_receipt_id: z.string().nullable().optional(),
  output_hash: z.string().nullable().optional(),
  output_summary: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  tokens_in: z.number().int().nonnegative().nullable().optional(),
  tokens_out: z.number().int().nonnegative().nullable().optional(),
  cost_usd: z.number().nonnegative().nullable().optional(),
  latency_ms: z.number().int().nonnegative().nullable().optional(),
  tool_calls: z.array(z.string()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  callback_verified: z.boolean().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
})
export type CreateReceiptInput = z.infer<typeof CreateReceiptInput>

/**
 * What the client sends to PATCH /api/v1/receipts/:id/complete.
 */
export const CompleteReceiptInput = z.object({
  // Required — must transition from pending
  status: z.enum(['completed', 'failed', 'timeout']),

  // Execution results (all optional — set what you know)
  output_hash: z.string().nullable().optional(),
  output_summary: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  tokens_in: z.number().int().nonnegative().nullable().optional(),
  tokens_out: z.number().int().nonnegative().nullable().optional(),
  cost_usd: z.number().nonnegative().nullable().optional(),
  latency_ms: z.number().int().nonnegative().nullable().optional(),
  tool_calls: z.array(z.string()).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  callback_verified: z.boolean().nullable().optional(),
  error: z.record(z.unknown()).nullable().optional(),
})
export type CompleteReceiptInput = z.infer<typeof CompleteReceiptInput>

/**
 * What GET /api/v1/verify/:id returns.
 * Note: Does NOT include org_id, metadata, tags, or output_summary (org-private).
 */
export const VerifyResponse = z.object({
  verified: z.boolean(),
  receipt: z.object({
    receipt_id: z.string(),
    chain_id: z.string(),
    receipt_type: ReceiptType,
    agent_id: z.string(),
    action: z.string(),
    status: ReceiptStatus,
    input_hash: z.string(),
    output_hash: z.string().nullable(),
    signature: z.string(),
    timestamp: z.string().datetime(),
    completed_at: z.string().datetime().nullable(),
    environment: Environment,
    latency_ms: z.number().int().nonnegative().nullable(),
  }),
  signature_valid: z.boolean(),
  chain_length: z.number().int().nonnegative(),
  public_key_url: z.string().url(),
})
export type VerifyResponse = z.infer<typeof VerifyResponse>

/**
 * Query parameters for GET /api/v1/receipts.
 */
export const ListReceiptsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  agent_id: z.string().optional(),
  action: z.string().optional(),
  status: ReceiptStatus.optional(),
  environment: Environment.optional(),
  receipt_type: ReceiptType.optional(),
  chain_id: z.string().optional(),
  tag: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.string().regex(/^(created_at|completed_at|latency_ms|cost_usd):(asc|desc)$/).default('created_at:desc'),
})
export type ListReceiptsQuery = z.infer<typeof ListReceiptsQuery>

/**
 * Pagination metadata included in list responses.
 */
export const PaginationMeta = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative(),
  has_next: z.boolean(),
  has_prev: z.boolean(),
})
export type PaginationMeta = z.infer<typeof PaginationMeta>

/**
 * Standard error response format.
 */
export const ErrorResponse = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    status: z.number().int(),
  }),
})
export type ErrorResponse = z.infer<typeof ErrorResponse>
