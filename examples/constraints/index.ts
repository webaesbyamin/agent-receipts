import { AgentReceipts } from '@agent-receipts/sdk'

async function main() {
  const receipts = new AgentReceipts()

  // Example 1: Track with passing constraints
  console.log('--- Example 1: Passing constraints ---')
  const passing = await receipts.track({
    action: 'fast_classification',
    input: { text: 'Classify this product review' },
    output: { category: 'positive', score: 0.95 },
    model: 'claude-3-haiku',
    latency_ms: 150,
    cost_usd: 0.0001,
    confidence: 0.95,
    constraints: [
      { type: 'max_latency_ms', value: 5000, message: 'Must respond within 5 seconds' },
      { type: 'max_cost_usd', value: 0.01 },
      { type: 'min_confidence', value: 0.8 },
      { type: 'status_must_be', value: 'completed' },
    ],
  })

  const passingResult = passing.constraint_result as { passed: boolean; results: Array<{ type: string; passed: boolean }> }
  console.log(`Receipt: ${passing.receipt_id}`)
  console.log(`All constraints passed: ${passingResult.passed}`)
  for (const r of passingResult.results) {
    console.log(`  ${r.passed ? '\u2713' : '\u2717'} ${r.type}`)
  }

  // Example 2: Track with failing constraints
  console.log('\n--- Example 2: Failing constraints ---')
  const failing = await receipts.track({
    action: 'slow_analysis',
    input: { document: 'Long document content...' },
    output: { analysis: 'Detailed analysis...' },
    model: 'claude-3-opus',
    latency_ms: 8000,
    cost_usd: 0.05,
    confidence: 0.62,
    constraints: [
      { type: 'max_latency_ms', value: 5000 },
      { type: 'max_cost_usd', value: 0.01 },
      { type: 'min_confidence', value: 0.8 },
    ],
  })

  const failingResult = failing.constraint_result as { passed: boolean; results: Array<{ type: string; passed: boolean; expected: unknown; actual: unknown }> }
  console.log(`Receipt: ${failing.receipt_id}`)
  console.log(`All constraints passed: ${failingResult.passed}`)
  for (const r of failingResult.results) {
    console.log(`  ${r.passed ? '\u2713' : '\u2717'} ${r.type}: expected=${r.expected}, actual=${r.actual}`)
  }

  // Example 3: Inspecting constraint results
  console.log('\n--- Example 3: Inspecting stored results ---')
  const fetched = await receipts.get(failing.receipt_id)
  if (fetched?.constraint_result) {
    const cr = fetched.constraint_result as { passed: boolean; evaluated_at: string; results: unknown[] }
    console.log(`Evaluated at: ${cr.evaluated_at}`)
    console.log(`Result: ${cr.passed ? 'PASSED' : 'FAILED'} (${cr.results.length} constraints)`)
  }

  // Show totals
  const all = await receipts.list()
  console.log(`\nTotal receipts: ${all.pagination.total}`)
}

main().catch(console.error)
