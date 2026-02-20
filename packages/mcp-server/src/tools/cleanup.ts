import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerCleanup(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'cleanup',
    'Delete expired receipts based on their expires_at metadata.',
    {
      dry_run: z.boolean().default(false).describe('If true, show what would be deleted without actually deleting'),
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
