import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ error: 'Not available in demo mode' }, { status: 404 })
    }
    const { id } = await params
    const { getMemoryStore } = await import('@/lib/sdk-server')
    const memoryStore = await getMemoryStore()
    const entity = memoryStore.getEntity(id)
    if (!entity) {
      return NextResponse.json({ error: `Entity not found: ${id}` }, { status: 404 })
    }

    const observations = memoryStore.getObservations(id, true)
    const relationships = memoryStore.getRelationships(id)

    return NextResponse.json({ entity, observations, relationships })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
