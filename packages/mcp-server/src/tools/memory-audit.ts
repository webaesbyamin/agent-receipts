import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { MemoryEngine } from '../engine/memory-engine.js'

export function registerMemoryAudit(server: McpServer, memoryEngine: MemoryEngine): void {
  server.tool(
    'memory_audit',
    'Generate an audit report of memory operations. Shows what was remembered, forgotten, merged, and by which agents over a time period.',
    {
      agent_id: z.string().optional().describe('Filter by agent'),
      entity_id: z.string().optional().describe('Filter by entity'),
      from: z.string().optional().describe('Start date (ISO 8601)'),
      to: z.string().optional().describe('End date (ISO 8601)'),
    },
    async (params) => {
      const report = memoryEngine.memoryAudit({
        agentId: params.agent_id,
        entityId: params.entity_id,
        from: params.from,
        to: params.to,
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(report, null, 2),
        }],
      }
    },
  )
}
