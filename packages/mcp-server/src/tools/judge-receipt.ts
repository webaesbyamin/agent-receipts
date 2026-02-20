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
    'Evaluate a receipt against a rubric. Creates a pending judgment receipt and returns evaluation instructions for the host model.',
    {
      receipt_id: z.string().describe('The receipt ID to evaluate'),
      rubric: RubricInput.describe('Evaluation rubric with criteria and thresholds'),
      output_summary_for_review: z.string().optional().describe(
        'Additional context about what the agent produced for evaluation.'
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
