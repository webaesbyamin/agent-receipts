import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerGetPublicKey(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'get_public_key',
    'Export the Ed25519 public key used for signing receipts.',
    {},
    async () => {
      const publicKey = engine.getPublicKey()
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            algorithm: 'Ed25519',
            public_key: publicKey,
            format: 'hex',
          }, null, 2),
        }],
      }
    },
  )
}
