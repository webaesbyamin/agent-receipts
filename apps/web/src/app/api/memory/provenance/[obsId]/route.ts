import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ obsId: string }> }
) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ error: 'Not available in demo mode' }, { status: 404 })
    }
    const { obsId } = await params
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
