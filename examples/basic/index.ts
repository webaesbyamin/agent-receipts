import { AgentReceipts } from '@agentreceipts/sdk'

async function main() {
  const receipts = new AgentReceipts()

  // Track a simple action
  const receipt = await receipts.track({
    action: 'summarize_text',
    input: { text: 'The quick brown fox jumps over the lazy dog.' },
    output: { summary: 'A fox jumped over a dog.' },
    output_summary: 'A fox jumped over a dog.',
    model: 'gpt-4',
    tokens_in: 15,
    tokens_out: 8,
    cost_usd: 0.001,
    latency_ms: 450,
    tags: ['demo', 'summarization'],
  })

  console.log('Receipt created:', receipt.receipt_id)
  console.log('Chain ID:', receipt.chain_id)
  console.log('Input hash:', receipt.input_hash)
  console.log('Output hash:', receipt.output_hash)

  // Verify the receipt
  const { verified } = await receipts.verify(receipt.receipt_id)
  console.log('Verified:', verified)

  // Retrieve it
  const fetched = await receipts.get(receipt.receipt_id)
  console.log('Fetched receipt action:', fetched?.action)

  // Get public key
  const publicKey = await receipts.getPublicKey()
  console.log('Public key:', publicKey)
}

main().catch(console.error)
