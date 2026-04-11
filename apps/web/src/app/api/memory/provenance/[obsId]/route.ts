import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ obsId: string }> }
) {
  try {
    const { obsId } = await params
    if (isDemoMode()) {
      const { getDemoMemoryStore } = await import('@/lib/demo-memory-store')
      const store = getDemoMemoryStore()
      const result = store.getProvenance(obsId)
      if (!result) {
        return NextResponse.json({ error: `Observation not found: ${obsId}` }, { status: 404 })
      }
      return NextResponse.json(result)
    }
    const { getMemoryEngine } = await import('@/lib/sdk-server')
    const memoryEngine = await getMemoryEngine()
    const result = memoryEngine.provenance(obsId)
    if (!result) {
      return NextResponse.json({ error: `Observation not found: ${obsId}` }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
