import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MemoryStore } from '../storage/memory-store.js'

export function registerMemoryEntities(server: McpServer, memoryStore: MemoryStore): void {
  server.tool(
    'memory_entities',
    'List known entities (people, projects, organizations, etc.) with optional filtering. Returns entities with their observation counts.',
    {
      entity_type: z.enum(['person', 'project', 'organization', 'preference', 'fact', 'context', 'tool', 'custom']).optional(),
      scope: z.enum(['agent', 'user', 'team']).optional(),
      query: z.string().optional().describe('Search entity names and aliases'),
      include_forgotten: z.boolean().optional().describe('Include forgotten entities (default: false)'),
      limit: z.number().optional().describe('Max results (default: 20)'),
    },
    async (params) => {
      const result = memoryStore.findEntities({
        entity_type: params.entity_type,
        scope: params.scope,
        query: params.query,
        include_forgotten: params.include_forgotten ?? false,
        limit: params.limit ?? 20,
        page: 1,
      })

      // Enrich with observation counts
      const enriched = result.data.map(entity => {
        const obs = memoryStore.getObservations(entity.entity_id, false)
        return {
          ...entity,
          observation_count: obs.length,
          latest_observation: obs[0]?.observed_at ?? null,
        }
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            entities: enriched,
            pagination: result.pagination,
          }, null, 2),
        }],
      }
    },
  )
}
