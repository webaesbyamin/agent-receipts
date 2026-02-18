import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerCompleteReceipt(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'complete_receipt',
    'Complete a pending receipt with execution results.',
    {
      receipt_id: z.string().describe('The receipt ID to complete'),
      status: z.enum(['completed', 'failed', 'timeout']).describe('Final status'),
      output_hash: z.string().nullable().optional().describe('Hash of the output data'),
      output_summary: z.string().nullable().optional().describe('Human-readable summary'),
      model: z.string().nullable().optional().describe('AI model used'),
      tokens_in: z.number().int().nonnegative().nullable().optional().describe('Input tokens'),
      tokens_out: z.number().int().nonnegative().nullable().optional().describe('Output tokens'),
      cost_usd: z.number().nonnegative().nullable().optional().describe('Cost in USD'),
      latency_ms: z.number().int().nonnegative().nullable().optional().describe('Latency in milliseconds'),
      tool_calls: z.array(z.string()).nullable().optional().describe('Tools called'),
      confidence: z.number().min(0).max(1).nullable().optional().describe('Confidence score 0-1'),
      callback_verified: z.boolean().nullable().optional().describe('Whether callback was verified'),
      error: z.record(z.unknown()).nullable().optional().describe('Error details if failed'),
    },
    async (params) => {
      const { receipt_id, ...completeParams } = params
      const receipt = await engine.complete(receipt_id, completeParams)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(receipt, null, 2) }],
      }
    },
  )
}
