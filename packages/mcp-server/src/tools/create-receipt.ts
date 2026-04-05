import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerCreateReceipt(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'create_receipt',
    'Create an Ed25519-signed receipt with pre-computed SHA-256 hashes. Use when you have already hashed the input/output data externally or need full control over receipt fields. For automatic hashing, use track_action instead. Returns the signed receipt object with receipt_id. The receipt is stored locally in SQLite and can be completed later with complete_receipt.',
    {
      action: z.string().describe('Action name being recorded (e.g., "generate_code", "analyze_data")'),
      input_hash: z.string().describe('Pre-computed SHA-256 hash of the input data in format "sha256:hexstring"'),
      receipt_type: z.enum(['action', 'verification', 'judgment', 'arbitration']).optional().describe('Receipt type: "action" (default), "verification", "judgment", or "arbitration"'),
      output_hash: z.string().nullable().optional().describe('Pre-computed SHA-256 hash of the output data in format "sha256:hexstring"'),
      output_summary: z.string().nullable().optional().describe('Human-readable summary of the output'),
      model: z.string().nullable().optional().describe('AI model used'),
      tokens_in: z.number().int().nonnegative().nullable().optional().describe('Input tokens'),
      tokens_out: z.number().int().nonnegative().nullable().optional().describe('Output tokens'),
      cost_usd: z.number().nonnegative().nullable().optional().describe('Cost in USD'),
      latency_ms: z.number().int().nonnegative().nullable().optional().describe('Latency in milliseconds'),
      tool_calls: z.array(z.string()).nullable().optional().describe('Tools called during the action'),
      tags: z.array(z.string()).nullable().optional().describe('Tags for categorization'),
      confidence: z.number().min(0).max(1).nullable().optional().describe('Confidence score 0-1'),
      metadata: z.record(z.unknown()).optional().describe('Arbitrary metadata'),
      parent_receipt_id: z.string().nullable().optional().describe('Parent receipt ID for chains'),
      chain_id: z.string().optional().describe('Chain ID (auto-generated if not provided)'),
      status: z.enum(['pending', 'completed', 'failed', 'timeout']).optional().describe('Initial status: "pending" (default, complete later) or "completed"'),
      constraints: z.array(z.object({
        type: z.string().min(1),
        value: z.unknown(),
        message: z.string().optional(),
      })).optional().describe('Array of constraint definitions to evaluate (types: max_latency_ms, max_cost_usd, min_confidence, required_fields, status_must_be, output_schema)'),
      expires_at: z.string().datetime().optional().describe('ISO datetime when this receipt expires'),
      ttl_ms: z.number().positive().optional().describe('Time-to-live in milliseconds from now'),
    },
    async (params) => {
      const receipt = await engine.create(params)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(receipt, null, 2) }],
      }
    },
  )
}
