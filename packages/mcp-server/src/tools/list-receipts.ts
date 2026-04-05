import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerListReceipts(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'list_receipts',
    'Query and paginate receipts from local SQLite storage with optional filtering by agent, action, status, environment, type, chain, or tag. Supports sorting by timestamp, cost, or latency. Returns paginated results with total count, page info, and has_next/has_prev flags. Default: 50 receipts per page, sorted by timestamp descending. Use to audit agent activity, generate reports, or find specific receipts.',
    {
      agent_id: z.string().optional().describe('Filter by agent ID (exact match)'),
      action: z.string().optional().describe('Filter by action name (exact match)'),
      status: z.enum(['pending', 'completed', 'failed', 'timeout']).optional().describe('Filter by status: "pending", "completed", "failed", or "timeout"'),
      environment: z.enum(['development', 'production', 'staging', 'test']).optional().describe('Filter by environment: "development", "production", "staging", or "test"'),
      receipt_type: z.enum(['action', 'verification', 'judgment', 'arbitration']).optional().describe('Filter by type: "action", "verification", "judgment", or "arbitration"'),
      chain_id: z.string().optional().describe('Filter to receipts in a specific chain'),
      tag: z.string().optional().describe('Filter to receipts containing this tag'),
      page: z.number().int().positive().optional().describe('Page number, starting at 1 (default: 1)'),
      limit: z.number().int().positive().max(100).optional().describe('Results per page, 1 to 100 (default: 50)'),
      sort: z.string().optional().describe('Sort field and direction in format "field:asc" or "field:desc" (e.g., "timestamp:desc", "cost_usd:asc")'),
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
