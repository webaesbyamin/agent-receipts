import { NextResponse } from 'next/server'
import { getStore, getKeyManager } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const store = await getStore()
    const allResult = await store.list(undefined, 1, 10000, 'timestamp:desc') // TODO: replace with server-side aggregation in v0.3.0
    const receipts = allResult.data

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const receiptsToday = receipts.filter(r => r.timestamp >= todayStart).length
    const receiptsThisWeek = receipts.filter(r => r.timestamp >= weekStart).length

    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const recentAgents = new Set(receipts.filter(r => r.timestamp >= last24h).map(r => r.agent_id))

    // Constraint stats
    let constraintsEvaluated = 0
    let constraintsPassed = 0
    let constraintsFailed = 0

    for (const r of receipts) {
      const cr = r.constraint_result as { passed?: boolean } | null
      if (cr && typeof cr.passed === 'boolean') {
        constraintsEvaluated++
        if (cr.passed) constraintsPassed++
        else constraintsFailed++
      }
    }

    // Judgment stats
    const judgments = receipts.filter(r => r.receipt_type === 'judgment')
    const completedJudgments = judgments.filter(r => r.status === 'completed')
    let judgmentsPassed = 0
    for (const j of completedJudgments) {
      const meta = j.metadata as Record<string, unknown> | null
      const verdict = meta?.verdict as string | undefined
      if (verdict === 'pass') judgmentsPassed++
    }

    // Performance stats
    const withLatency = receipts.filter(r => r.latency_ms !== null)
    const avgLatency = withLatency.length > 0
      ? withLatency.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / withLatency.length
      : 0

    const withCost = receipts.filter(r => r.cost_usd !== null)
    const avgCost = withCost.length > 0
      ? withCost.reduce((s, r) => s + (r.cost_usd ?? 0), 0) / withCost.length
      : 0
    const totalCost = withCost.reduce((s, r) => s + (r.cost_usd ?? 0), 0)

    // Receipt volume (last 14 days)
    const volumeMap = new Map<string, number>()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      volumeMap.set(key, 0)
    }
    for (const r of receipts) {
      const key = r.timestamp.slice(0, 10)
      if (volumeMap.has(key)) {
        volumeMap.set(key, (volumeMap.get(key) ?? 0) + 1)
      }
    }
    const receiptVolume = Array.from(volumeMap.entries()).map(([date, count]) => ({ date, count }))

    // Constraint trend (last 14 days)
    const trendMap = new Map<string, { passed: number; total: number }>()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      trendMap.set(key, { passed: 0, total: 0 })
    }
    for (const r of receipts) {
      const key = r.timestamp.slice(0, 10)
      const cr = r.constraint_result as { passed?: boolean } | null
      if (cr && typeof cr.passed === 'boolean' && trendMap.has(key)) {
        const entry = trendMap.get(key)!
        entry.total++
        if (cr.passed) entry.passed++
      }
    }
    const constraintTrend = Array.from(trendMap.entries()).map(([date, { passed, total }]) => ({
      date,
      pass_rate: total > 0 ? passed / total : 1,
      total,
    }))

    // Try to get public key
    let publicKey = ''
    try {
      const km = await getKeyManager()
      publicKey = km.getPublicKey()
    } catch {}

    return NextResponse.json({
      total_receipts: receipts.length,
      receipts_today: receiptsToday,
      receipts_this_week: receiptsThisWeek,
      active_agents: recentAgents.size,
      constraint_pass_rate: constraintsEvaluated > 0 ? constraintsPassed / constraintsEvaluated : 1,
      constraints_evaluated: constraintsEvaluated,
      constraints_failed: constraintsFailed,
      judgments_total: judgments.length,
      judgments_pass_rate: completedJudgments.length > 0 ? judgmentsPassed / completedJudgments.length : 0,
      avg_latency_ms: Math.round(avgLatency),
      avg_cost_usd: avgCost,
      total_cost_usd: totalCost,
      receipt_volume: receiptVolume,
      constraint_trend: constraintTrend,
      public_key: publicKey,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
