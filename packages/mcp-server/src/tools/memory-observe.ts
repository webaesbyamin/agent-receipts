import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MemoryEngine } from '../engine/memory-engine.js'

export function registerMemoryObserve(server: McpServer, memoryEngine: MemoryEngine, agentId: string): void {
  server.tool(
    'memory_observe',
    'Store a memory observation about a person, project, preference, or any entity. Automatically creates the entity if it doesn\'t exist. Every observation is cryptographically signed and linked to a receipt.',
    {
      entity_name: z.string().describe('Name of the entity (person, project, tool, etc.)'),
      entity_type: z.enum(['person', 'project', 'organization', 'preference', 'fact', 'context', 'tool', 'custom']).describe('Type of entity'),
      content: z.string().describe('The observation/fact to remember'),
      confidence: z.enum(['certain', 'high', 'medium', 'low']).optional().describe('How confident you are in this observation (default: medium)'),
      scope: z.enum(['agent', 'user', 'team']).optional().describe('Who can see this memory (default: agent)'),
      context: z.string().optional().describe('What conversation or task produced this observation'),
      tags: z.array(z.string()).optional().describe('Tags for categorization'),
    },
    async (params) => {
      const result = await memoryEngine.observe({
        entityName: params.entity_name,
        entityType: params.entity_type,
        content: params.content,
        confidence: params.confidence,
        scope: params.scope,
        agentId,
        context: params.context,
        tags: params.tags,
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            entity: result.entity,
            observation: result.observation,
            receipt_id: result.receipt.receipt_id,
            created_entity: result.created_entity,
          }, null, 2),
        }],
      }
    },
  )
}
