import { AgentReceipts } from '@agent-receipts/sdk'

async function main() {
  const ar = new AgentReceipts()

  // Example 1: Create a receipt with a 30-day TTL
  console.log('--- Example 1: TTL via ttl_ms ---')
  const ttlReceipt = await ar.track({
    action: 'temp_analysis',
    input: { data: 'temporary analysis request' },
    output: { result: 'analysis complete', score: 0.87 },
    ttl_ms: 30 * 24 * 60 * 60 * 1000, // 30 days
  })
  const ttlMeta = ttlReceipt.metadata as Record<string, unknown>
  console.log(`Receipt: ${ttlReceipt.receipt_id}`)
  console.log(`Expires at: ${ttlMeta.expires_at}`)

  // Example 2: Create a receipt with an explicit expiration date
  console.log('\n--- Example 2: Explicit expires_at ---')
  const explicitReceipt = await ar.track({
    action: 'session_quote',
    input: { customer: 'John Doe', vehicle: 'BMW M3' },
    output: { total: 2200, currency: 'USD' },
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  })
  const expMeta = explicitReceipt.metadata as Record<string, unknown>
  console.log(`Receipt: ${explicitReceipt.receipt_id}`)
  console.log(`Expires at: ${expMeta.expires_at}`)

  // Example 3: Create a receipt without TTL (permanent)
  console.log('\n--- Example 3: No TTL (permanent) ---')
  const permanentReceipt = await ar.track({
    action: 'audit_log',
    input: { event: 'user_login', user_id: 'u123' },
    output: { logged: true },
  })
  const permMeta = permanentReceipt.metadata as Record<string, unknown>
  console.log(`Receipt: ${permanentReceipt.receipt_id}`)
  console.log(`Expires at: ${permMeta.expires_at ?? 'never'}`)

  // Example 4: Cleanup expired receipts
  console.log('\n--- Example 4: Cleanup ---')
  const { deleted, remaining } = await ar.cleanup()
  console.log(`Cleaned up ${deleted} expired receipt(s). ${remaining} remaining.`)
}

main().catch(console.error)
