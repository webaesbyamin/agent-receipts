import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q')?.toLowerCase()
    if (!q || q.length < 2) {
      return NextResponse.json({ receipts: [], agents: [], chains: [] })
    }

    const store = await getStore()
    const allResult = await store.list(undefined, 1, 10000, 'timestamp:desc') // TODO: replace with server-side aggregation in v0.3.0
    const receipts = allResult.data

    const matchingReceipts = receipts
      .filter(r =>
        r.receipt_id.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        (r.output_summary ?? '').toLowerCase().includes(q) ||
        (r.chain_id ?? '').toLowerCase().includes(q) ||
        r.agent_id.toLowerCase().includes(q)
      )
      .slice(0, 10)
      .map(r => ({
        receipt_id: r.receipt_id,
        action: r.action,
        agent_id: r.agent_id,
        timestamp: r.timestamp,
      }))

    const matchingAgents = [...new Set(
      receipts
        .filter(r => r.agent_id.toLowerCase().includes(q))
        .map(r => r.agent_id)
    )].slice(0, 5)

    const matchingChains = [...new Set(
      receipts
        .filter(r => r.chain_id && r.chain_id.toLowerCase().includes(q))
        .map(r => r.chain_id!)
    )].slice(0, 5)

    return NextResponse.json({
      receipts: matchingReceipts,
      agents: matchingAgents,
      chains: matchingChains,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
