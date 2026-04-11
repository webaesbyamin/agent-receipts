import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MemoryEngine } from '../engine/memory-engine.js'

export function registerMemoryProvenance(server: McpServer, memoryEngine: MemoryEngine): void {
  server.tool(
    'memory_provenance',
    'Get the full provenance chain for a memory observation. Shows when it was created, which conversation produced it, which agent made the observation, and every subsequent modification.',
    {
      observation_id: z.string().describe('The observation to trace'),
    },
    async (params) => {
      const result = memoryEngine.provenance(params.observation_id)
      if (!result) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: `Observation not found: ${params.observation_id}` }),
          }],
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            observation: result.observation,
            entity: result.entity,
            receipt_id: result.receipt_id,
            chain: result.chain,
          }, null, 2),
        }],
      }
    },
  )
}
