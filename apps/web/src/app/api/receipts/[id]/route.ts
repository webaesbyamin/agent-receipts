import { NextRequest, NextResponse } from 'next/server'
import { getStore, getKeyManager } from '@/lib/storage'
import { verifyReceipt, getSignablePayload } from '@agent-receipts/crypto'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const store = await getStore()

    const receipt = await store.get(id)
    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    // Verify signature
    let verified = false
    try {
      const km = await getKeyManager()
      const signable = getSignablePayload(receipt)
      verified = verifyReceipt(signable, receipt.signature, km.getPublicKey())
    } catch {}

    // Get chain receipts
    let chain: unknown[] | undefined
    if (receipt.chain_id) {
      const chainReceipts = await store.getChain(receipt.chain_id)
      if (chainReceipts.length > 1) {
        chain = chainReceipts
      }
    }

    // Get judgments
    const judgmentResult = await store.list({
      parent_receipt_id: receipt.receipt_id,
      receipt_type: 'judgment',
    })
    const judgments = judgmentResult.data.length > 0 ? judgmentResult.data : undefined

    // Get children
    const childResult = await store.list({ parent_receipt_id: receipt.receipt_id })
    const children = childResult.data.filter(r => r.receipt_type !== 'judgment')
    const childrenOut = children.length > 0 ? children : undefined

    return NextResponse.json({
      receipt,
      verified,
      chain,
      judgments,
      children: childrenOut,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
