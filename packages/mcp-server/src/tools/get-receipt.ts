import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerGetReceipt(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'get_receipt',
    'Retrieve a single receipt by its ID from local SQLite storage. Returns the full receipt object including all 27 fields: identity, timestamps, action data, performance metrics, constraints, cryptographic proof, and metadata. Returns an error message if the receipt ID does not exist. Use to inspect a specific receipt or retrieve it before verification.',
    {
      receipt_id: z.string().describe('The receipt ID to retrieve (format: "rcpt_" followed by 12 alphanumeric characters)'),
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
