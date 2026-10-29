import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerVerifyReceipt(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'verify_receipt',
    'Cryptographically verify the Ed25519 signature on a stored receipt to confirm it has not been changed since signing. Receipt format v2 signs every field (summary, cost, model, metadata, files and the chain link); legacy v1 receipts sign 12 core fields only. Returns verified, sig_version and covers_all_fields. To check a whole chain for edited, removed or forked receipts, use the CLI: agent-receipts verify-chain <chain_id>. Use to audit receipts before using them as evidence or before completing payments based on agent work.',
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
            sig_version: result.details.sig_version,
            covers_all_fields: result.details.covers_all_fields,
            key_id: result.receipt.key_id ?? null,
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
