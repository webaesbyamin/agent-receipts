import { AgentReceipts } from '@agentreceipts/sdk'

async function main() {
  const receipts = new AgentReceipts()

  // Step 1: Start a pending receipt
  const step1 = await receipts.start({
    action: 'fetch_document',
    input_hash: 'sha256:abc123',
    tags: ['pipeline', 'document-processing'],
  })

  console.log('Step 1 created (pending):', step1.receipt_id)
  console.log('Chain ID:', step1.chain_id)

  // Step 1: Complete it
  const completed1 = await receipts.complete(step1.receipt_id, {
    status: 'completed',
    output_hash: 'sha256:def456',
    output_summary: 'Fetched 3-page document',
    latency_ms: 200,
  })
  console.log('Step 1 completed:', completed1.status)

  // Step 2: Chain the next action to the same chain
  const step2 = await receipts.track({
    action: 'extract_entities',
    input: { document_id: 'doc-123', pages: 3 },
    output: { entities: ['Alice', 'Bob', 'Acme Corp'] },
    output_summary: 'Extracted 3 entities',
    parent_receipt_id: completed1.receipt_id,
    chain_id: completed1.chain_id,
    model: 'gpt-4',
    tokens_in: 1200,
    tokens_out: 50,
    latency_ms: 800,
    tags: ['pipeline', 'ner'],
  })

  console.log('Step 2 created:', step2.receipt_id)
  console.log('Same chain?', step2.chain_id === step1.chain_id)

  // Step 3: Final step in the chain
  const step3 = await receipts.track({
    action: 'generate_report',
    input: { entities: ['Alice', 'Bob', 'Acme Corp'] },
    output: { report: 'Summary report with 3 entities...' },
    output_summary: 'Generated report',
    parent_receipt_id: step2.receipt_id,
    chain_id: step2.chain_id,
    model: 'gpt-4',
    tokens_in: 500,
    tokens_out: 300,
    latency_ms: 1200,
    tags: ['pipeline', 'report'],
  })

  console.log('Step 3 created:', step3.receipt_id)

  // List the full chain
  const result = await receipts.list({ chain_id: step1.chain_id })
  console.log(`\nChain ${step1.chain_id} (${result.data.length} receipts):`)
  for (const r of result.data) {
    console.log(`  ${r.receipt_id}  ${r.action}  ${r.status}`)
  }
}

main().catch(console.error)
