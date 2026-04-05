import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerGetPublicKey(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'get_public_key',
    'Export the Ed25519 public key used to sign all receipts on this instance. Returns the key as a 64-character hex string. Share this key with clients or third parties so they can independently verify receipt signatures without accessing your private key. The private key never leaves your machine — only the public key is needed for verification.',
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
