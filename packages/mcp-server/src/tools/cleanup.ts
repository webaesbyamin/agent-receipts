import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerCleanup(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'cleanup',
    'Delete receipts that have passed their expiration time based on the expires_at field in metadata. Expired receipts are receipts where metadata.expires_at is set and is earlier than the current time. Supports dry_run mode to preview deletions without committing. Returns count of deleted receipts and remaining total. Use periodically to manage storage and enforce TTL policies set during receipt creation.',
    {
      dry_run: z.boolean().default(false).describe('If true, returns what would be deleted without actually deleting. Defaults to false.'),
    },
    async (params) => {
      if (params.dry_run) {
        const now = new Date().toISOString()
        const all = await engine.list(undefined, 1, 100000)
        const expired = all.data.filter(r => {
          const expiresAt = (r.metadata as Record<string, unknown>)?.expires_at as string | undefined
          return expiresAt && expiresAt < now
        })
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              dry_run: true,
              would_delete: expired.length,
              total: all.data.length,
              expired_receipts: expired.map(r => ({
                receipt_id: r.receipt_id,
                action: r.action,
                expires_at: (r.metadata as Record<string, unknown>)?.expires_at,
              })),
            }, null, 2),
          }],
        }
      }

      const result = await engine.cleanup()
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            deleted: result.deleted,
            remaining: result.remaining,
          }, null, 2),
        }],
      }
    },
  )
}
