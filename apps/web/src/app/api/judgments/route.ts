import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const sort = searchParams.get('sort') ?? 'timestamp:desc'

    const store = await getStore()
    const allResult = await store.list({ receipt_type: 'judgment' }, 1, 10000, sort) // TODO: replace with server-side aggregation in v0.3.0
    let data = allResult.data

    // Filter by receipt_id (parent receipt)
    const receiptId = searchParams.get('receipt_id')
    if (receiptId) {
      data = data.filter(r => r.parent_receipt_id === receiptId)
    }

    // Filter by verdict
    const verdict = searchParams.get('verdict')
    if (verdict) {
      data = data.filter(r => {
        const meta = r.metadata as Record<string, unknown> | null
        return meta?.verdict === verdict
      })
    }

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
