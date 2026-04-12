import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MemoryEngine } from '../engine/memory-engine.js'

export function registerMemoryExportBundle(server: McpServer, memoryEngine: MemoryEngine): void {
  server.tool(
    'memory_export_bundle',
    'Export memories as a portable, verifiable bundle. Includes entities, observations, relationships, source receipts, and the public key needed to verify them. Share with other agents or import into another Agent Receipts instance.',
    {
      entity_ids: z.array(z.string()).optional().describe('Export specific entities (default: all)'),
      include_receipts: z.boolean().optional().describe('Include source receipts for verification (default: true)'),
      include_forgotten: z.boolean().optional().describe('Include forgotten/deleted memories (default: false)'),
      description: z.string().optional().describe('Description of what this bundle contains'),
    },
    async (params) => {
      const bundle = await memoryEngine.exportBundle({
        entityIds: params.entity_ids,
        includeReceipts: params.include_receipts,
        includeForgotten: params.include_forgotten,
        description: params.description,
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(bundle, null, 2),
        }],
      }
    },
  )
}
