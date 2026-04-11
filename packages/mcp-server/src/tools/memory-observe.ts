import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MemoryEngine } from '../engine/memory-engine.js'
import type { MemoryStore } from '../storage/memory-store.js'

export function registerMemoryObserve(server: McpServer, memoryEngine: MemoryEngine, agentId: string, memoryStore?: MemoryStore): void {
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
      ttl_seconds: z.number().positive().optional().describe('Time-to-live in seconds. After this duration, the observation expires and is excluded from recall but retained for audit.'),
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
        ttlSeconds: params.ttl_seconds,
      })

      const response: Record<string, unknown> = {
        entity: result.entity,
        observation: result.observation,
        receipt_id: result.receipt.receipt_id,
        created_entity: result.created_entity,
      }

      if (result.created_entity && memoryStore) {
        const dupes = memoryStore.findPossibleDuplicates(result.entity.entity_id)
        if (dupes.length > 0) {
          response.possible_duplicates = dupes.map(d => ({ entity_id: d.entity_id, name: d.name }))
          response.duplicate_note = `Found ${dupes.length} possible duplicate(s): ${dupes.map(d => d.name).join(', ')}. If these refer to the same thing, use memory_merge to combine them.`
        }
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
