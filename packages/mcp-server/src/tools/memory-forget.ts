import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MemoryEngine } from '../engine/memory-engine.js'

export function registerMemoryForget(server: McpServer, memoryEngine: MemoryEngine, agentId: string): void {
  server.tool(
    'memory_forget',
    'Forget a specific observation or an entire entity. This is a soft delete — the memory is marked as forgotten but retained for audit purposes. The forget operation itself is recorded as a signed receipt.',
    {
      entity_id: z.string().optional().describe('Entity to forget entirely (all its observations)'),
      observation_id: z.string().optional().describe('Specific observation to forget'),
      reason: z.string().optional().describe('Why this memory is being forgotten'),
    },
    async (params) => {
      const result = await memoryEngine.forget({
        entityId: params.entity_id,
        observationId: params.observation_id,
        agentId,
        reason: params.reason,
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            forgotten: params.entity_id ? `entity:${params.entity_id}` : `observation:${params.observation_id}`,
            receipt_id: result.receipt.receipt_id,
            reason: params.reason,
          }, null, 2),
        }],
      }
    },
  )
}
