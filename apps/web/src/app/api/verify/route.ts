import { NextRequest, NextResponse } from 'next/server'
import { getKeyManager } from '@/lib/sdk-server'
import { verifyReceipt as verifyReceiptCrypto, getSignablePayload } from '@agent-receipts/crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const receipt = body.receipt
    let publicKey = body.public_key as string | undefined

    if (!receipt || !receipt.receipt_id) {
      return NextResponse.json({ error: 'Invalid receipt' }, { status: 400 })
    }

    // Use local key if not provided
    if (!publicKey) {
      try {
        const km = await getKeyManager()
        publicKey = km.getPublicKey()
      } catch {
        return NextResponse.json({
          verified: false,
          public_key_used: '',
          receipt_id: receipt.receipt_id,
          error: 'No public key provided and local key not available',
        })
      }
    }

    try {
      const signable = getSignablePayload(receipt)
      const verified = verifyReceiptCrypto(signable, receipt.signature, publicKey)

      return NextResponse.json({
        verified,
        public_key_used: publicKey,
        receipt_id: receipt.receipt_id,
      })
    } catch (err) {
      return NextResponse.json({
        verified: false,
        public_key_used: publicKey ?? '',
        receipt_id: receipt.receipt_id,
        error: err instanceof Error ? err.message : 'Verification failed',
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
