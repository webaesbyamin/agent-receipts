import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'
import { hashData } from '../hash.js'

export function registerCompleteJudgment(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'complete_judgment',
    'Submit evaluation results to finalize a pending judgment receipt created by judge_receipt. Records the verdict, overall score, per-criterion scores and reasoning, and confidence. The judgment receipt is re-signed with Ed25519 and linked to the original receipt via parent_receipt_id. Returns the judgment receipt ID, verdict, score, and chain ID. Use immediately after evaluating the prompt returned by judge_receipt.',
    {
      judgment_receipt_id: z.string().describe('The pending judgment receipt ID returned by judge_receipt'),
      verdict: z.enum(['pass', 'fail', 'partial']).describe('Overall evaluation result: "pass" (meets threshold), "fail" (below threshold), or "partial" (mixed results)'),
      score: z.number().min(0).max(1).describe('Overall quality score from 0.0 to 1.0'),
      criteria_results: z.array(z.object({
        criterion: z.string(),
        score: z.number().min(0).max(1),
        reasoning: z.string(),
      })).describe('Array of per-criterion results. Each item needs: criterion (name string), score (0.0-1.0), reasoning (explanation string)'),
      overall_reasoning: z.string().describe('Overall explanation of the evaluation verdict'),
      confidence: z.number().min(0).max(1).describe('Your confidence in this evaluation, 0.0 to 1.0'),
    },
    async (params) => {
      const receipt = await engine.get(params.judgment_receipt_id)
      if (!receipt) {
        return {
          content: [{ type: 'text' as const, text: `Error: Judgment receipt not found: ${params.judgment_receipt_id}` }],
          isError: true,
        }
      }

      if (receipt.receipt_type !== 'judgment') {
        return {
          content: [{ type: 'text' as const, text: `Error: Receipt ${params.judgment_receipt_id} is not a judgment receipt (type: ${receipt.receipt_type})` }],
          isError: true,
        }
      }

      if (receipt.status !== 'pending') {
        return {
          content: [{ type: 'text' as const, text: `Error: Judgment receipt ${params.judgment_receipt_id} is not pending (status: ${receipt.status})` }],
          isError: true,
        }
      }

      const rubricVersion = (receipt.metadata as Record<string, unknown>)?.rubric_version as string ?? '1.0'

      const judgmentResult = {
        verdict: params.verdict,
        score: params.score,
        criteria_results: params.criteria_results.map(cr => ({
          criterion: cr.criterion,
          score: cr.score,
          passed: cr.score >= 0.7, // default threshold
          reasoning: cr.reasoning,
        })),
        overall_reasoning: params.overall_reasoning,
        rubric_version: rubricVersion,
      }

      const summaryText = params.overall_reasoning.length > 200
        ? params.overall_reasoning.substring(0, 200) + '...'
        : params.overall_reasoning

      const completed = await engine.complete(params.judgment_receipt_id, {
        status: 'completed',
        output_hash: hashData(judgmentResult),
        output_summary: `${params.verdict.toUpperCase()} (${params.score.toFixed(2)}) — ${summaryText}`,
        confidence: params.confidence,
        metadata: {
          ...receipt.metadata,
          judgment: judgmentResult,
        },
      })

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            judgment_receipt_id: completed.receipt_id,
            verdict: params.verdict,
            score: params.score,
            parent_receipt_id: completed.parent_receipt_id,
            chain_id: completed.chain_id,
          }, null, 2),
        }],
      }
    },
  )
}
