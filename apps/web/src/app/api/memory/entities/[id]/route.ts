import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (isDemoMode()) {
      const { getDemoMemoryStore } = await import('@/lib/demo-memory-store')
      const store = getDemoMemoryStore()
      const entity = store.getEntity(id)
      if (!entity) {
        return NextResponse.json({ error: `Entity not found: ${id}` }, { status: 404 })
      }
      const observations = store.getObservations(id, true)
      const relationships = store.getRelationships(id)
      return NextResponse.json({ entity, observations, relationships })
    }
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
