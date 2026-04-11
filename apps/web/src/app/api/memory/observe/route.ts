import { NextRequest, NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ error: 'Not available in demo mode' }, { status: 400 })
    }
    const { getMemoryEngine, getConfigManager } = await import('@/lib/sdk-server')
    const memoryEngine = await getMemoryEngine()
    const configManager = await getConfigManager()
    const config = configManager.getConfig()

    const body = await request.json() as {
      entity_name: string
      entity_type: string
      content: string
      confidence?: string
      scope?: string
      context?: string
      tags?: string[]
    }

    const result = await memoryEngine.observe({
      entityName: body.entity_name,
      entityType: body.entity_type as 'person' | 'project',
      content: body.content,
      confidence: body.confidence as 'certain' | 'high' | 'medium' | 'low' | undefined,
      scope: body.scope as 'agent' | 'user' | 'team' | undefined,
      agentId: config.agentId,
      context: body.context,
      tags: body.tags,
    })

    return NextResponse.json({
      entity: result.entity,
      observation: result.observation,
      receipt_id: result.receipt.receipt_id,
      created_entity: result.created_entity,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
