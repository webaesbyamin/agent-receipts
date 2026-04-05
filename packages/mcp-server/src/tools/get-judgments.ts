import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

export function registerGetJudgments(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'get_judgments',
    'Retrieve all judgment receipts associated with a given receipt ID. Judgment receipts are linked via parent_receipt_id. Returns an array of judgment receipt objects ordered by timestamp, including verdict, score, criteria results, and confidence. Use to review the evaluation history of a receipt, compare multiple judgments, or audit AI quality assessments. Returns empty array if no judgments exist.',
    {
      receipt_id: z.string().describe('The original receipt ID to get judgments for (not the judgment receipt ID)'),
    },
    async (params) => {
      const judgments = await engine.getJudgments(params.receipt_id)
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            receipt_id: params.receipt_id,
            count: judgments.length,
            judgments: judgments.map(j => ({
              judgment_id: j.receipt_id,
              verdict: (j.metadata as Record<string, unknown>)?.judgment
                ? ((j.metadata as Record<string, unknown>).judgment as Record<string, unknown>).verdict
                : null,
              score: (j.metadata as Record<string, unknown>)?.judgment
                ? ((j.metadata as Record<string, unknown>).judgment as Record<string, unknown>).score
                : null,
              status: j.status,
              output_summary: j.output_summary,
              confidence: j.confidence,
              timestamp: j.timestamp,
              completed_at: j.completed_at,
            })),
          }, null, 2),
        }],
      }
    },
  )
}
