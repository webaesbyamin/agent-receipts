import { AgentReceipts } from '@agent-receipts/sdk'

async function main() {
  const receipts = new AgentReceipts()

  // Simulate a content moderation pipeline
  const userMessage = 'Please review this product listing for compliance.'

  // Step 1: Classify the content
  const classification = await receipts.track({
    action: 'classify_content',
    input: { message: userMessage, context: 'product_listing' },
    output: { category: 'compliance_review', risk_level: 'low' },
    output_summary: 'Classified as compliance_review (low risk)',
    model: 'claude-3-haiku',
    tokens_in: 45,
    tokens_out: 12,
    cost_usd: 0.0001,
    latency_ms: 150,
    confidence: 0.95,
    tags: ['moderation', 'classification'],
  })

  console.log('Classification receipt:', classification.receipt_id)

  // Step 2: Generate a moderation quote/estimate
  const quote = await receipts.track({
    action: 'generate_mod_quote',
    input: {
      classification: 'compliance_review',
      risk_level: 'low',
      content_length: userMessage.length,
    },
    output: {
      estimated_time_ms: 5000,
      model_recommendation: 'claude-3-sonnet',
      estimated_cost_usd: 0.005,
      priority: 'normal',
    },
    output_summary: 'Quote: 5s, $0.005, normal priority',
    parent_receipt_id: classification.receipt_id,
    chain_id: classification.chain_id,
    model: 'claude-3-haiku',
    tokens_in: 80,
    tokens_out: 30,
    cost_usd: 0.0002,
    latency_ms: 200,
    tags: ['moderation', 'quote'],
    metadata: {
      pipeline_version: '1.0',
      region: 'us-east-1',
    },
  })

  console.log('Quote receipt:', quote.receipt_id)

  // Verify the entire chain
  for (const r of [classification, quote]) {
    const { verified } = await receipts.verify(r.receipt_id)
    console.log(`  ${r.action}: verified=${verified}`)
  }

  // List all receipts
  const all = await receipts.list()
  console.log(`\nTotal receipts: ${all.pagination.total}`)
}

main().catch(console.error)
