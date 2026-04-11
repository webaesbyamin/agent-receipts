import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (isDemoMode()) {
      const { getDemoMemoryStore } = await import('@/lib/demo-memory-store')
      const store = getDemoMemoryStore()
      const { searchParams } = request.nextUrl
      const result = store.findEntities({
        entity_type: (searchParams.get('entity_type') as 'person' | 'project') || undefined,
        scope: (searchParams.get('scope') as 'agent' | 'user') || undefined,
        query: searchParams.get('query') || undefined,
        include_forgotten: searchParams.get('include_forgotten') === 'true',
        limit: parseInt(searchParams.get('limit') || '20', 10),
        page: parseInt(searchParams.get('page') || '1', 10),
      })
      const enriched = result.data.map(entity => {
        const obs = store.getObservations(entity.entity_id, false)
        return {
          ...entity,
          observation_count: obs.length,
          latest_observation: obs[0]?.observed_at ?? null,
        }
      })
      return NextResponse.json({ entities: enriched, pagination: result.pagination })
    }
    const { getMemoryStore } = await import('@/lib/sdk-server')
    const memoryStore = await getMemoryStore()
    const { searchParams } = request.nextUrl
    const result = memoryStore.findEntities({
      entity_type: (searchParams.get('entity_type') as 'person' | 'project') || undefined,
      scope: (searchParams.get('scope') as 'agent' | 'user') || undefined,
      query: searchParams.get('query') || undefined,
      include_forgotten: searchParams.get('include_forgotten') === 'true',
      limit: parseInt(searchParams.get('limit') || '20', 10),
      page: parseInt(searchParams.get('page') || '1', 10),
    })

    const enriched = result.data.map(entity => {
      const obs = memoryStore.getObservations(entity.entity_id, false)
      return {
        ...entity,
        observation_count: obs.length,
        latest_observation: obs[0]?.observed_at ?? null,
      }
    })

    return NextResponse.json({ entities: enriched, pagination: result.pagination })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
