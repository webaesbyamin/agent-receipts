import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (isDemoMode()) {
      const { getDemoMemoryStore } = await import('@/lib/demo-memory-store')
      const store = getDemoMemoryStore()
      return NextResponse.json(store.getMemoryStats())
    }
    const { getMemoryEngine } = await import('@/lib/sdk-server')
    const memoryEngine = await getMemoryEngine()
    const { searchParams } = request.nextUrl
    const report = memoryEngine.memoryAudit({
      agentId: searchParams.get('agent_id') || undefined,
      entityId: searchParams.get('entity_id') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
    })
    return NextResponse.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
