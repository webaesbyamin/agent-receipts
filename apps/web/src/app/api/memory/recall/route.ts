import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (isDemoMode()) {
      const { getDemoMemoryStore } = await import('@/lib/demo-memory-store')
      const store = getDemoMemoryStore()
      const { searchParams } = request.nextUrl
      const result = store.recall({
        query: searchParams.get('query') || undefined,
        entity_type: (searchParams.get('entity_type') as 'person' | 'project') || undefined,
        scope: (searchParams.get('scope') as 'agent' | 'user') || undefined,
        include_forgotten: false,
        limit: parseInt(searchParams.get('limit') || '20', 10),
        page: 1,
      })
      return NextResponse.json(result)
    }
    const { getMemoryStore } = await import('@/lib/sdk-server')
    const memoryStore = await getMemoryStore()
    const { searchParams } = request.nextUrl
    const query = searchParams.get('query') || undefined

    const result = memoryStore.recall({
      query,
      entity_type: (searchParams.get('entity_type') as 'person' | 'project') || undefined,
      scope: (searchParams.get('scope') as 'agent' | 'user') || undefined,
      include_forgotten: false,
      limit: parseInt(searchParams.get('limit') || '20', 10),
      page: 1,
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
