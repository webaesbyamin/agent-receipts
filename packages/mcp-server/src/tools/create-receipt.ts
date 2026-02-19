import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerCreateReceipt(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'create_receipt',
    'Create a new receipt with pre-computed hashes. Use track_action instead for automatic hashing.',
    {
      action: z.string().describe('The action being recorded'),
      input_hash: z.string().describe('Pre-computed hash of the input data (sha256:hex)'),
      receipt_type: z.enum(['action', 'verification', 'judgment', 'arbitration']).optional().describe('Type of receipt'),
      output_hash: z.string().nullable().optional().describe('Pre-computed hash of the output data'),
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
      status: z.enum(['pending', 'completed', 'failed', 'timeout']).optional().describe('Receipt status'),
      constraints: z.array(z.object({
        type: z.string().min(1),
        value: z.unknown(),
        message: z.string().optional(),
      })).optional().describe('Constraint definitions to evaluate'),
    },
    async (params) => {
      const receipt = await engine.create(params)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(receipt, null, 2) }],
      }
    },
  )
}
