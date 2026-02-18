import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerTrackAction(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'track_action',
    'Track an agent action with automatic input/output hashing. This is the primary tool for recording receipts.',
    {
      action: z.string().describe('The action being recorded (e.g., "generate_summary", "classify_email")'),
      input: z.unknown().describe('The input data (will be automatically hashed)'),
      output: z.unknown().optional().describe('The output data (will be automatically hashed)'),
      output_summary: z.string().optional().describe('Human-readable summary of the output'),
      model: z.string().optional().describe('AI model used (e.g., "gpt-4", "claude-3")'),
      tokens_in: z.number().int().nonnegative().optional().describe('Input tokens consumed'),
      tokens_out: z.number().int().nonnegative().optional().describe('Output tokens generated'),
      cost_usd: z.number().nonnegative().optional().describe('Cost in USD'),
      latency_ms: z.number().int().nonnegative().optional().describe('Latency in milliseconds'),
      tool_calls: z.array(z.string()).optional().describe('Tools called during the action'),
      tags: z.array(z.string()).optional().describe('Tags for categorization'),
      confidence: z.number().min(0).max(1).optional().describe('Confidence score 0-1'),
      metadata: z.record(z.unknown()).optional().describe('Arbitrary metadata'),
      parent_receipt_id: z.string().optional().describe('Parent receipt ID for chaining'),
      chain_id: z.string().optional().describe('Chain ID (auto-generated if not provided)'),
    },
    async (params) => {
      const receipt = await engine.track(params)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(receipt, null, 2) }],
      }
    },
  )
}
