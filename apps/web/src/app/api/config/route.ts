import { NextRequest, NextResponse } from 'next/server'
import { getConfigManager, getKeyManager, getDataDir, getStore } from '@/lib/sdk-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cm = await getConfigManager()
    const config = cm.getConfig()
    const dataDir = getDataDir()

    let publicKey = ''
    try {
      const km = await getKeyManager()
      publicKey = km.getPublicKey()
    } catch {}

    let receiptCount = 0
    try {
      const store = await getStore()
      receiptCount = await store.count()
    } catch {}

    return NextResponse.json({
      ...config,
      data_dir: dataDir,
      public_key: publicKey,
      receipt_count: receiptCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const cm = await getConfigManager()

    const updates: Record<string, unknown> = {}
    if (body.agentId) updates.agentId = body.agentId
    if (body.orgId) updates.orgId = body.orgId
    if (body.environment && ['development', 'production', 'staging', 'test'].includes(body.environment)) {
      updates.environment = body.environment
    }

    await cm.update(updates as { agentId?: string; orgId?: string; environment?: 'development' | 'production' | 'staging' | 'test' })

    const config = cm.getConfig()
    return NextResponse.json(config)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
