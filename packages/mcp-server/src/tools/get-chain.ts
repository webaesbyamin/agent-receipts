import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerGetChain(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'get_chain',
    'Retrieve all receipts in a chain, ordered by timestamp.',
    {
      chain_id: z.string().describe('The chain ID to retrieve'),
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
