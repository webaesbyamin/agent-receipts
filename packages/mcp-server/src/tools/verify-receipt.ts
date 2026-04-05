import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerVerifyReceipt(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'verify_receipt',
    'Cryptographically verify an Ed25519 signature on a stored receipt to confirm it has not been tampered with since signing. Extracts the 12-field signable payload, canonicalizes it, and verifies against the stored public key. Returns verified: true if the signature is valid. Use to audit receipts before using them as evidence or before completing payments based on agent work.',
    {
      receipt_id: z.string().describe('The receipt ID to verify — must exist in local storage'),
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
