import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/sdk-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const dryRun = body.dry_run === true

    const store = await getStore()
    const now = new Date().toISOString()
    const allResult = await store.list(undefined, 1, 10000) // TODO: replace with server-side aggregation in v0.3.0

    const expiredReceipts = allResult.data.filter(r => {
      const expiresAt = (r.metadata as Record<string, unknown> | null)?.expires_at as string | undefined
      return expiresAt && expiresAt < now
    })

    if (dryRun) {
      return NextResponse.json({
        deleted: 0,
        remaining: allResult.data.length,
        expired_receipts: expiredReceipts,
      })
    }

    let deleted = 0
    for (const r of expiredReceipts) {
      const success = await store.delete(r.receipt_id)
      if (success) deleted++
    }

    return NextResponse.json({
      deleted,
      remaining: allResult.data.length - deleted,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
