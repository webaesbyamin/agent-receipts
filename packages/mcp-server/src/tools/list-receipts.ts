import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerListReceipts(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'list_receipts',
    'List receipts with optional filtering and pagination.',
    {
      agent_id: z.string().optional().describe('Filter by agent ID'),
      action: z.string().optional().describe('Filter by action name'),
      status: z.enum(['pending', 'completed', 'failed', 'timeout']).optional().describe('Filter by status'),
      environment: z.enum(['development', 'production', 'staging', 'test']).optional().describe('Filter by environment'),
      receipt_type: z.enum(['action', 'verification', 'judgment', 'arbitration']).optional().describe('Filter by type'),
      chain_id: z.string().optional().describe('Filter by chain ID'),
      tag: z.string().optional().describe('Filter by tag'),
      page: z.number().int().positive().optional().describe('Page number (default: 1)'),
      limit: z.number().int().positive().max(100).optional().describe('Items per page (default: 50, max: 100)'),
      sort: z.string().optional().describe('Sort field:direction (e.g., "timestamp:desc")'),
    },
    async (params) => {
      const { page, limit, sort, ...filter } = params
      const result = await engine.list(filter, page, limit, sort)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    },
  )
}
