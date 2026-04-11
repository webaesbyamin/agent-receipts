import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MemoryEngine } from '../engine/memory-engine.js'

export function registerMemoryRelate(server: McpServer, memoryEngine: MemoryEngine, agentId: string): void {
  server.tool(
    'memory_relate',
    'Create a relationship between two entities (e.g., "Amin" builds "ModQuote"). Relationships are bidirectional for querying but stored with a direction.',
    {
      from_entity_id: z.string().describe('Source entity ID'),
      to_entity_id: z.string().describe('Target entity ID'),
      relationship_type: z.string().describe('Type of relationship (e.g., "builds", "uses", "works_at", "prefers")'),
      strength: z.enum(['certain', 'high', 'medium', 'low']).optional(),
      context: z.string().optional().describe('What established this relationship'),
    },
    async (params) => {
      const result = await memoryEngine.relate({
        fromEntityId: params.from_entity_id,
        toEntityId: params.to_entity_id,
        relationshipType: params.relationship_type,
        agentId,
        strength: params.strength,
        context: params.context,
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            relationship: result.relationship,
            receipt_id: result.receipt.receipt_id,
          }, null, 2),
        }],
      }
    },
  )
}
