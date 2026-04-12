import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MemoryEngine } from '../engine/memory-engine.js'

export function registerMemoryRecall(server: McpServer, memoryEngine: MemoryEngine, agentId: string): void {
  server.tool(
    'memory_recall',
    'Search and retrieve stored memories. Use text search to find relevant observations across all entities, or filter by entity type, specific entity, or scope. Every recall is logged as a receipt.',
    {
      query: z.string().optional().describe('Text to search for across all observations'),
      entity_type: z.enum(['person', 'project', 'organization', 'preference', 'fact', 'context', 'tool', 'custom']).optional().describe('Filter by entity type'),
      entity_id: z.string().optional().describe('Get memories for a specific entity'),
      scope: z.enum(['agent', 'user', 'team']).optional().describe('Filter by memory scope'),
      limit: z.number().optional().describe('Max results to return (default: 20, max: 100)'),
      include_forgotten: z.boolean().optional().describe('Include soft-deleted memories (default: false)'),
      audited: z.boolean().optional().describe('Create a signed receipt for this read operation (default: false)'),
    },
    async (params) => {
      const result = await memoryEngine.recall({
        query: params.query,
        entityType: params.entity_type,
        entityId: params.entity_id,
        agentId,
        scope: params.scope,
        limit: params.limit,
        audited: params.audited,
      })

      const response: Record<string, unknown> = {
        entities: result.entities,
        observations: result.observations,
        total: result.observations.length,
        receipt_id: result.receipt?.receipt_id ?? null,
      }

      if (result.observations.length === 0) {
        response._guidance = 'No matches found. Try broader search terms, or check stored entities with memory_entities.'
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
