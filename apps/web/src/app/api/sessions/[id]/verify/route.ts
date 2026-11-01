import { NextRequest, NextResponse } from 'next/server'
import { verifyChainReceipts } from '@agent-receipts/mcp-server'
import { getStore, getKeyManager, isDemoMode } from '@/lib/storage'

export const dynamic = 'force-dynamic'

/**
 * Verify a session's chain: every signature against this machine's public key,
 * and every link to the receipt before it (the same check as `agent-receipts verify-chain`).
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (isDemoMode()) {
      return NextResponse.json({ error: 'The demo has no signed sessions to verify. Run the dashboard locally to verify your own.' }, { status: 400 })
    }
    const store = await getStore()
    const receipts = await store.getChain(id)
    if (receipts.length === 0) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    const publicKey = (await getKeyManager()).getPublicKey()
    const tombstones = (store as { getTombstoneHashes?: (chainId: string) => Set<string> }).getTombstoneHashes?.(id) ?? new Set<string>()
    const result = verifyChainReceipts(id, receipts, publicKey, tombstones)
    return NextResponse.json({ ...result, public_key: publicKey, checked_at: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
