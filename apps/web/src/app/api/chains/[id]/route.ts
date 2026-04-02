import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/storage'

export const dynamic = 'force-dynamic'

interface ChainNode {
  receipt: Record<string, unknown>
  children: ChainNode[]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const store = await getStore()
    const receipts = await store.getChain(id)

    if (receipts.length === 0) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 })
    }

    const agents = [...new Set(receipts.map(r => r.agent_id))]

    const timestamps = receipts.map(r => new Date(r.timestamp).getTime())
    const completedTimes = receipts
      .filter(r => r.completed_at)
      .map(r => new Date(r.completed_at!).getTime())
    const firstTs = Math.min(...timestamps)
    const lastTs = completedTimes.length > 0 ? Math.max(...completedTimes) : Math.max(...timestamps)
    const totalDuration = lastTs - firstTs

    const totalCost = receipts.reduce((s, r) => s + (r.cost_usd ?? 0), 0)

    let constraintsEvaluated = 0
    let constraintsPassed = 0
    for (const r of receipts) {
      const cr = r.constraint_result as { passed?: boolean } | null
      if (cr && typeof cr.passed === 'boolean') {
        constraintsEvaluated++
        if (cr.passed) constraintsPassed++
      }
    }

    const judgmentCount = receipts.filter(r => r.receipt_type === 'judgment').length

    // Build tree
    const receiptMap = new Map(receipts.map(r => [r.receipt_id, r]))
    const childrenMap = new Map<string, ChainNode[]>()
    const roots: ChainNode[] = []

    for (const r of receipts) {
      const node: ChainNode = { receipt: r as unknown as Record<string, unknown>, children: [] }
      if (r.parent_receipt_id && receiptMap.has(r.parent_receipt_id)) {
        if (!childrenMap.has(r.parent_receipt_id)) {
          childrenMap.set(r.parent_receipt_id, [])
        }
        childrenMap.get(r.parent_receipt_id)!.push(node)
      } else {
        roots.push(node)
      }
      childrenMap.set(r.receipt_id, node.children = childrenMap.get(r.receipt_id) ?? [])
    }

    // Reassign children
    for (const r of receipts) {
      const kids = childrenMap.get(r.receipt_id) ?? []
      const node = roots.find(n => (n.receipt as Record<string, unknown>).receipt_id === r.receipt_id)
        ?? findNode(roots, r.receipt_id)
      if (node) node.children = kids
    }

    return NextResponse.json({
      chain_id: id,
      receipts: receipts as unknown as Record<string, unknown>[],
      agents,
      total_duration_ms: totalDuration,
      total_cost_usd: totalCost,
      constraint_pass_rate: constraintsEvaluated > 0 ? constraintsPassed / constraintsEvaluated : 1,
      judgment_count: judgmentCount,
      tree: roots,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function findNode(nodes: ChainNode[], receiptId: string): ChainNode | null {
  for (const node of nodes) {
    if ((node.receipt as Record<string, unknown>).receipt_id === receiptId) return node
    const found = findNode(node.children, receiptId)
    if (found) return found
  }
  return null
}
