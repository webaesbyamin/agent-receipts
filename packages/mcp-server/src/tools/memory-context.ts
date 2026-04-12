import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MemoryEngine } from '../engine/memory-engine.js'

export function registerMemoryContext(server: McpServer, memoryEngine: MemoryEngine): void {
  server.tool(
    'memory_context',
    'Get a complete context dump of all stored memories — top entities, recent observations, active relationships, and preferences. Call this at the start of a conversation to understand what is already known about the user, their projects, and their preferences. Every context pull is logged as a signed receipt.',
    {
      scope: z.enum(['agent', 'user', 'team']).optional().describe('Filter memories by scope (default: returns all accessible scopes)'),
      max_entities: z.number().optional().describe('Maximum entities to return, ordered by activity (default: 10, max: 50)'),
      max_observations: z.number().optional().describe('Maximum recent observations to return (default: 20, max: 100)'),
      audited: z.boolean().optional().describe('Create a signed receipt for this read operation (default: false)'),
    },
    async (params) => {
      const result = await memoryEngine.getContext({
        scope: params.scope,
        maxEntities: params.max_entities,
        maxObservations: params.max_observations,
        audited: params.audited,
      })

      const response: Record<string, unknown> = {
        entities: result.entities,
        recent_observations: result.recent_observations,
        relationships: result.relationships,
        preferences: result.preferences,
        stats: result.stats,
        receipt_id: result.receipt?.receipt_id ?? null,
      }

      if (result.entities.length === 0 && result.recent_observations.length === 0) {
        response._guidance = 'No memories found yet. Use memory_observe to store observations as you learn about the user, their projects, and preferences.'
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(response, null, 2),
        }],
      }
    },
  )
}
