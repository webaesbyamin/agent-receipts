import { z } from 'zod'

export const ReceiptStatus = z.enum(['pending', 'completed', 'failed', 'timeout'])
export type ReceiptStatus = z.infer<typeof ReceiptStatus>

export const ReceiptType = z.enum(['action', 'verification', 'judgment', 'arbitration'])
export type ReceiptType = z.infer<typeof ReceiptType>

export const Environment = z.enum(['development', 'production', 'staging', 'test'])
export type Environment = z.infer<typeof Environment>

export const ErrorCode = z.enum([
  'UNAUTHORIZED',
  'KEY_REVOKED',
  'FORBIDDEN',
  'RECEIPT_NOT_FOUND',
  'CHAIN_NOT_FOUND',
  'AGENT_NOT_FOUND',
  'RECEIPT_NOT_PENDING',
  'RECEIPT_IMMUTABLE',
  'RATE_LIMIT_EXCEEDED',
  'VALIDATION_ERROR',
  'INTERNAL_ERROR',
])
export type ErrorCode = z.infer<typeof ErrorCode>
