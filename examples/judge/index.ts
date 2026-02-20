import { AgentReceipts } from '@agent-receipts/sdk'
import { hashData } from '@agent-receipts/mcp-server'
import type { JudgmentResult } from '@agent-receipts/schema'

/**
 * AI Judge Example
 *
 * In practice, the judge_receipt and complete_judgment MCP tools handle
 * creating and completing judgments via the host model (Claude/Cursor).
 *
 * This example shows how to READ judgments via the SDK — the read-only path.
 * It manually creates a judgment receipt to demonstrate the data structure.
 */
async function main() {
  const ar = new AgentReceipts()

  // Step 1: Create a receipt to be judged
  console.log('--- Step 1: Create receipt to judge ---')
  const receipt = await ar.track({
    action: 'generate_quote',
    input: { vehicle: 'Tesla Model 3', service: 'full-front-ppf' },
    output: { total: 1450, currency: 'USD', line_items: [{ name: 'Full Front PPF', price: 1450 }] },
    output_summary: 'Generated PPF quote for Tesla Model 3: $1,450',
    model: 'claude-sonnet',
    latency_ms: 2340,
    cost_usd: 0.008,
    confidence: 0.92,
  })
  console.log(`Receipt created: ${receipt.receipt_id}`)

  // Step 2: Simulate what the MCP tools do (create + complete judgment)
  // In real usage, the host model calls judge_receipt → evaluates → complete_judgment
  console.log('\n--- Step 2: Simulate judgment creation ---')
  const judgmentReceipt = await ar.start({
    receipt_type: 'judgment',
    action: 'judge',
    input_hash: hashData({ receipt_id: receipt.receipt_id }),
    parent_receipt_id: receipt.receipt_id,
    chain_id: receipt.chain_id,
  })

  const judgmentResult: JudgmentResult = {
    verdict: 'pass',
    score: 0.91,
    criteria_results: [
      { criterion: 'accuracy', score: 0.95, passed: true, reasoning: 'Pricing is correct for the model and service' },
      { criterion: 'completeness', score: 0.88, passed: true, reasoning: 'Includes line items and total' },
      { criterion: 'safety', score: 0.90, passed: true, reasoning: 'No harmful content' },
    ],
    overall_reasoning: 'The quote was accurate, well-structured, and addressed the customer need.',
    rubric_version: '1.0',
  }

  await ar.complete(judgmentReceipt.receipt_id, {
    status: 'completed',
    output_hash: hashData(judgmentResult),
    output_summary: `${judgmentResult.verdict.toUpperCase()} (${judgmentResult.score.toFixed(2)}) — ${judgmentResult.overall_reasoning.substring(0, 100)}`,
    confidence: 0.88,
    metadata: { judgment: judgmentResult },
  })

  // Step 3: Read judgments via SDK
  console.log('\n--- Step 3: Read judgments ---')
  const judgments = await ar.getJudgments(receipt.receipt_id)
  console.log(`Found ${judgments.length} judgment(s) for ${receipt.receipt_id}`)

  for (const j of judgments) {
    const result = (j.metadata as Record<string, unknown>)?.judgment as JudgmentResult
    console.log(`\n  Verdict: ${result.verdict.toUpperCase()} (${result.score.toFixed(2)})`)
    for (const cr of result.criteria_results) {
      const icon = cr.passed ? '\u2713' : '\u2717'
      console.log(`    ${icon} ${cr.criterion}: ${cr.score.toFixed(2)} — ${cr.reasoning}`)
    }
    console.log(`  Overall: ${result.overall_reasoning}`)
  }
}

main().catch(console.error)
