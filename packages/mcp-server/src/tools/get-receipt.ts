import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerGetReceipt(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'get_receipt',
    'Retrieve a receipt by its ID.',
    {
      receipt_id: z.string().describe('The receipt ID to retrieve'),
    },
    async (params) => {
      const receipt = await engine.get(params.receipt_id)
      if (!receipt) {
        return {
          content: [{ type: 'text' as const, text: `Receipt not found: ${params.receipt_id}` }],
          isError: true,
        }
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(receipt, null, 2) }],
      }
    },
  )
}
