import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerCompleteReceipt(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'complete_receipt',
    'Finalize a pending receipt by recording execution results, costs, and output data. Updates the receipt status to completed, failed, or timeout and re-signs with Ed25519. Use after create_receipt when you need to record results separately from creation (two-phase tracking). Cannot complete an already-completed receipt. Returns the updated signed receipt.',
    {
      receipt_id: z.string().describe('The receipt ID to complete — must be a pending receipt (status: "pending")'),
      status: z.enum(['completed', 'failed', 'timeout']).describe('Final status: "completed" (success), "failed" (error occurred), or "timeout" (timed out)'),
      output_hash: z.string().nullable().optional().describe('Pre-computed SHA-256 hash of the output in format "sha256:hexstring"'),
      output_summary: z.string().nullable().optional().describe('Human-readable summary of the execution result'),
      model: z.string().nullable().optional().describe('AI model used during execution'),
      tokens_in: z.number().int().nonnegative().nullable().optional().describe('Input tokens consumed'),
      tokens_out: z.number().int().nonnegative().nullable().optional().describe('Output tokens generated'),
      cost_usd: z.number().nonnegative().nullable().optional().describe('Total cost in USD'),
      latency_ms: z.number().int().nonnegative().nullable().optional().describe('Total execution time in milliseconds'),
      tool_calls: z.array(z.string()).nullable().optional().describe('Names of tools called during execution'),
      confidence: z.number().min(0).max(1).nullable().optional().describe('Confidence score for output quality, 0.0 to 1.0'),
      callback_verified: z.boolean().nullable().optional().describe('Whether an external callback verified the result'),
      error: z.record(z.unknown()).nullable().optional().describe('Error details if status is "failed" (e.g., {"code": "TIMEOUT", "message": "..."})'),
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
