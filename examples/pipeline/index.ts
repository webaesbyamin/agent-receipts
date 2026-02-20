import { AgentReceipts } from '@agent-receipts/sdk'

async function main() {
  const ar = new AgentReceipts({
    dataDir: '/tmp/agent-receipts-pipeline-demo',
  })

  // Step 1: Extract text from document
  const extract = await ar.track({
    action: 'extract_text',
    input: { document_url: 'https://example.com/report.pdf', pages: 12 },
    output: { text_length: 4500, language: 'en', sections: ['intro', 'methodology', 'results', 'conclusion'] },
    agent_id: 'doc-processor',
    org_id: 'acme-corp',
    model: 'claude-3-haiku',
    tokens_in: 850,
    tokens_out: 4500,
    cost_usd: 0.002,
    latency_ms: 1200,
    confidence: 0.97,
    output_summary: 'Extracted 4,500 characters from 12-page research report',
    constraints: [
      { type: 'max_latency_ms', value: 5000, message: 'Extraction must complete within 5 seconds' },
      { type: 'required_fields', value: ['output_hash', 'output_summary'] },
    ],
  })

  console.log('Step 1 — Extract:', extract.receipt_id, extract.constraint_result?.passed ? '✓' : '✗')

  // Step 2: Analyze and classify (chained to extraction)
  const analyze = await ar.track({
    action: 'classify_document',
    input: { source_receipt: extract.receipt_id, categories: ['research', 'legal', 'financial', 'technical'] },
    output: { category: 'research', confidence: 0.92, topics: ['machine learning', 'transformer architectures'] },
    agent_id: 'classifier',
    org_id: 'acme-corp',
    parent_receipt_id: extract.receipt_id,
    chain_id: extract.chain_id,
    model: 'claude-3-sonnet',
    tokens_in: 4500,
    tokens_out: 120,
    cost_usd: 0.008,
    latency_ms: 890,
    confidence: 0.92,
    output_summary: 'Classified as research paper on ML/transformers (92% confidence)',
    constraints: [
      { type: 'min_confidence', value: 0.8, message: 'Classification confidence must be at least 80%' },
      { type: 'max_cost_usd', value: 0.05, message: 'Classification must cost less than $0.05' },
      {
        type: 'output_schema',
        value: {
          type: 'object',
          required: ['category', 'confidence'],
          properties: {
            category: { type: 'string', enum: ['research', 'legal', 'financial', 'technical'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
        message: 'Output must match classification schema',
      },
    ],
  })

  console.log('Step 2 — Classify:', analyze.receipt_id, analyze.constraint_result?.passed ? '✓' : '✗')

  // Step 3: Generate summary (chained to analysis)
  const summarize = await ar.track({
    action: 'generate_summary',
    input: { source_receipt: analyze.receipt_id, max_length: 500, style: 'executive' },
    output: { summary: 'This paper presents a novel approach to...', word_count: 487 },
    agent_id: 'summarizer',
    org_id: 'acme-corp',
    parent_receipt_id: analyze.receipt_id,
    chain_id: extract.chain_id,
    model: 'claude-3-sonnet',
    tokens_in: 4500,
    tokens_out: 650,
    cost_usd: 0.012,
    latency_ms: 2100,
    confidence: 0.88,
    output_summary: 'Generated 487-word executive summary',
    constraints: [
      { type: 'max_latency_ms', value: 10000 },
      { type: 'min_confidence', value: 0.7 },
    ],
  })

  console.log('Step 3 — Summarize:', summarize.receipt_id, summarize.constraint_result?.passed ? '✓' : '✗')

  // Verify the chain
  const chain = await ar.list({ chain_id: extract.chain_id })
  console.log(`\nPipeline complete: ${chain.data.length} receipts in chain ${extract.chain_id}`)

  // Verify all receipts
  for (const receipt of chain.data) {
    const { verified } = await ar.verify(receipt.receipt_id)
    console.log(`  ${receipt.action}: ${verified ? '✓ verified' : '✗ INVALID'}`)
  }

  // Show public key for external verification
  const publicKey = await ar.getPublicKey()
  console.log(`\nPublic key for verification: ${publicKey}`)
}

main().catch(console.error)
