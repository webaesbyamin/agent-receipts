import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerVerifyReceipt(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'verify_receipt',
    'Verify the cryptographic signature of a receipt.',
    {
      receipt_id: z.string().describe('The receipt ID to verify'),
    },
    async (params) => {
      const result = await engine.verify(params.receipt_id)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            verified: result.verified,
            receipt_id: result.receipt.receipt_id,
            action: result.receipt.action,
            status: result.receipt.status,
            signature: result.receipt.signature,
          }, null, 2),
        }],
      }
    },
  )
}
