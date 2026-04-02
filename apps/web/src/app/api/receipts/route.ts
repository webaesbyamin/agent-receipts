import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/storage'
import type { ReceiptFilter } from '@agent-receipts/mcp-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const sort = searchParams.get('sort') ?? 'timestamp:desc'

    const filter: ReceiptFilter = {}
    const agentId = searchParams.get('agent_id')
    if (agentId) filter.agent_id = agentId
    const action = searchParams.get('action')
    if (action) filter.action = action
    const status = searchParams.get('status')
    if (status) filter.status = status as ReceiptFilter['status']
    const environment = searchParams.get('environment')
    if (environment) filter.environment = environment as ReceiptFilter['environment']
    const receiptType = searchParams.get('receipt_type')
    if (receiptType) filter.receipt_type = receiptType as ReceiptFilter['receipt_type']
    const chainId = searchParams.get('chain_id')
    if (chainId) filter.chain_id = chainId
    const from = searchParams.get('from')
    if (from) filter.from = from
    const to = searchParams.get('to')
    if (to) filter.to = to

    const store = await getStore()
    let result = await store.list(filter, 1, 10000, sort) // TODO: replace with server-side aggregation in v0.3.0
    let data = result.data

    // Post-filter: search
    const search = searchParams.get('search')
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(r =>
        r.receipt_id.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        (r.output_summary ?? '').toLowerCase().includes(q) ||
        (r.chain_id ?? '').toLowerCase().includes(q) ||
        r.agent_id.toLowerCase().includes(q)
      )
    }

    // Post-filter: constraint_passed
    const constraintPassed = searchParams.get('constraint_passed')
    if (constraintPassed === 'true') {
      data = data.filter(r => {
        const cr = r.constraint_result as { passed?: boolean } | null
        return cr && cr.passed === true
      })
    } else if (constraintPassed === 'false') {
      data = data.filter(r => {
        const cr = r.constraint_result as { passed?: boolean } | null
        return cr && cr.passed === false
      })
    }

    // Post-filter: has_judgments
    const hasJudgments = searchParams.get('has_judgments')
    if (hasJudgments === 'true' || hasJudgments === 'false') {
      // We'd need to check parent_receipt_id across all receipts
      // For now, skip this filter since it's expensive
    }

    // Post-filter: expired
    const expired = searchParams.get('expired')
    if (expired === 'false') {
      const now = new Date().toISOString()
      data = data.filter(r => {
        const expiresAt = (r.metadata as Record<string, unknown> | null)?.expires_at as string | undefined
        return !expiresAt || expiresAt > now
      })
    }

    // Paginate the post-filtered data
    const total = data.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const start = (page - 1) * limit
    const paged = data.slice(start, start + limit)

    return NextResponse.json({
      data: paged,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
