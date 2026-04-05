import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerGetChain(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'get_chain',
    'Retrieve all receipts belonging to a chain, ordered by timestamp ascending to show the sequence of operations. A chain groups related receipts from a multi-step agent workflow. Returns the complete receipt objects for every step. Use to audit a complete workflow, calculate total chain cost and duration, or identify which step in a pipeline failed.',
    {
      chain_id: z.string().describe('The chain ID to retrieve (format: "chain_" followed by 8 alphanumeric characters)'),
    },
    async (params) => {
      const receipts = await engine.getChain(params.chain_id)
      if (receipts.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `No receipts found for chain: ${params.chain_id}` }],
        }
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(receipts, null, 2) }],
      }
    },
  )
}
