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
      entity_id?: string
      observation_id?: string
      reason?: string
    }

    const result = await memoryEngine.forget({
      entityId: body.entity_id,
      observationId: body.observation_id,
      agentId: config.agentId,
      reason: body.reason,
    })

    return NextResponse.json({ receipt_id: result.receipt.receipt_id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
