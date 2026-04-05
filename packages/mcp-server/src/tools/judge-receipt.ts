import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'
import { hashData } from '../hash.js'

const RubricCriterionInput = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().min(0).max(1),
  passing_threshold: z.number().min(0).max(1).optional(),
})

const RubricInput = z.object({
  version: z.string().default('1.0'),
  criteria: z.array(RubricCriterionInput).min(1),
  passing_threshold: z.number().min(0).max(1).default(0.7),
  require_all: z.boolean().default(false),
})

export function registerJudgeReceipt(server: McpServer, engine: ReceiptEngine): void {
  server.tool(
    'judge_receipt',
    'Start an AI judgment evaluation for a receipt by creating a pending judgment receipt and returning a structured evaluation prompt. The host model (you) evaluates the receipt\'s output against the provided rubric criteria and then calls complete_judgment with the results. Use to assess output quality beyond simple pass/fail constraints — supports weighted criteria, partial verdicts, and confidence scores. Judgment receipts are themselves Ed25519-signed for auditability.',
    {
      receipt_id: z.string().describe('The receipt ID to evaluate — the original action receipt'),
      rubric: RubricInput.describe('Evaluation rubric with criteria array. Each criterion needs: name (string), description (string), weight (0.0-1.0), and optional passing_threshold (0.0-1.0, default 0.7). Also set: passing_threshold (overall, default 0.7) and require_all (boolean, default false)'),
      output_summary_for_review: z.string().optional().describe(
        'The actual output content to evaluate — provide if output_summary on the receipt is insufficient for evaluation'
      ),
    },
    async (params) => {
      const receipt = await engine.get(params.receipt_id)
      if (!receipt) {
        return {
          content: [{ type: 'text' as const, text: `Error: Receipt not found: ${params.receipt_id}` }],
          isError: true,
        }
      }

      if (receipt.status !== 'completed') {
        return {
          content: [{ type: 'text' as const, text: `Error: Receipt ${params.receipt_id} is not completed (status: ${receipt.status}). Only completed receipts can be judged.` }],
          isError: true,
        }
      }

      const rubric = RubricInput.parse(params.rubric)

      // Create a pending judgment receipt
      const judgmentReceipt = await engine.create({
        receipt_type: 'judgment',
        action: 'judge',
        input_hash: hashData({ receipt_id: params.receipt_id, rubric }),
        parent_receipt_id: receipt.receipt_id,
        chain_id: receipt.chain_id,
        status: 'pending',
        metadata: {
          rubric_hash: hashData(rubric),
          rubric_version: rubric.version,
        },
      })

      // Build constraint summary
      let constraintInfo = 'None'
      if (receipt.constraint_result && typeof receipt.constraint_result === 'object' && 'passed' in receipt.constraint_result) {
        const cr = receipt.constraint_result as { passed: boolean; results: Array<{ passed: boolean }> }
        const passedCount = cr.results.filter(r => r.passed).length
        constraintInfo = `${passedCount}/${cr.results.length} ${cr.passed ? 'PASSED' : 'FAILED'}`
      }

      // Build criteria text
      const criteriaText = rubric.criteria.map((c, i) => {
        const threshold = c.passing_threshold !== undefined ? `, threshold: ${c.passing_threshold}` : ''
        return `**Criterion ${i + 1}: ${c.name}** (weight: ${c.weight}${threshold})\n${c.description}`
      }).join('\n\n')

      const outputInfo = params.output_summary_for_review ?? receipt.output_summary ?? 'No output summary available'

      const prompt = `## Receipt Evaluation Request

I've created judgment receipt \`${judgmentReceipt.receipt_id}\` for receipt \`${receipt.receipt_id}\`.

Please evaluate the following receipt against the rubric below, then call the \`complete_judgment\` tool with your evaluation.

### Receipt Under Review
- **Receipt ID:** ${receipt.receipt_id}
- **Action:** ${receipt.action}
- **Agent:** ${receipt.agent_id}
- **Status:** ${receipt.status}
- **Output Summary:** ${outputInfo}
- **Latency:** ${receipt.latency_ms != null ? `${receipt.latency_ms}ms` : 'N/A'}
- **Cost:** ${receipt.cost_usd != null ? `$${receipt.cost_usd}` : 'N/A'}
- **Constraints:** ${constraintInfo}

### Rubric (v${rubric.version}, passing threshold: ${rubric.passing_threshold})

${criteriaText}

### Instructions

Evaluate each criterion on a 0-1 scale with reasoning. Then call \`complete_judgment\` with:
- \`judgment_receipt_id\`: "${judgmentReceipt.receipt_id}"
- \`verdict\`: "pass", "fail", or "partial"
- \`score\`: overall score 0-1
- \`criteria_results\`: array of { criterion, score, reasoning } for each criterion
- \`overall_reasoning\`: your overall assessment
- \`confidence\`: your confidence in this evaluation (0-1)`

      return {
        content: [{ type: 'text' as const, text: prompt }],
      }
    },
  )
}
