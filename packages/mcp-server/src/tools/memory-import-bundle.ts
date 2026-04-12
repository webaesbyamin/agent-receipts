import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MemoryEngine } from '../engine/memory-engine.js'

export function registerMemoryImportBundle(server: McpServer, memoryEngine: MemoryEngine): void {
  server.tool(
    'memory_import_bundle',
    'Import a memory bundle from another Agent Receipts instance. Verifies checksums before importing. Skips memories that already exist locally. The import operation itself is recorded as a signed receipt.',
    {
      bundle: z.record(z.unknown()).describe('The memory bundle JSON object to import'),
      skip_existing: z.boolean().optional().describe('Skip entities/observations that already exist (default: true)'),
    },
    async (params) => {
      const result = await memoryEngine.importBundle(
        params.bundle as Parameters<typeof memoryEngine.importBundle>[0],
        { skipExisting: params.skip_existing },
      )

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            imported: result.imported,
            skipped: result.skipped,
            receipt_id: result.receipt.receipt_id,
          }, null, 2),
        }],
      }
    },
  )
}
