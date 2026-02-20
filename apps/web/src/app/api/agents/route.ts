import { NextResponse } from 'next/server'
import { getStore } from '@/lib/sdk-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const store = await getStore()
    const allResult = await store.list(undefined, 1, 100000, 'timestamp:desc')
    const receipts = allResult.data

    const agentMap = new Map<string, {
      agent_id: string
      total_receipts: number
      last_active: string
      actions: Set<string>
      latencies: number[]
      costs: number[]
      total_cost_usd: number
      constraint_evaluated: number
      constraint_passed: number
      judgment_count: number
      judgment_passed: number
      completed: number
      failed: number
      pending: number
      timeout: number
    }>()

    for (const r of receipts) {
      let agent = agentMap.get(r.agent_id)
      if (!agent) {
        agent = {
          agent_id: r.agent_id,
          total_receipts: 0,
          last_active: r.timestamp,
          actions: new Set(),
          latencies: [],
          costs: [],
          total_cost_usd: 0,
          constraint_evaluated: 0,
          constraint_passed: 0,
          judgment_count: 0,
          judgment_passed: 0,
          completed: 0,
          failed: 0,
          pending: 0,
          timeout: 0,
        }
        agentMap.set(r.agent_id, agent)
      }

      agent.total_receipts++
      if (r.timestamp > agent.last_active) agent.last_active = r.timestamp
      agent.actions.add(r.action)
      if (r.latency_ms !== null) agent.latencies.push(r.latency_ms)
      if (r.cost_usd !== null) {
        agent.costs.push(r.cost_usd)
        agent.total_cost_usd += r.cost_usd
      }

      const cr = r.constraint_result as { passed?: boolean } | null
      if (cr && typeof cr.passed === 'boolean') {
        agent.constraint_evaluated++
        if (cr.passed) agent.constraint_passed++
      }

      if (r.receipt_type === 'judgment') {
        agent.judgment_count++
        const meta = r.metadata as Record<string, unknown> | null
        if (meta?.verdict === 'pass') agent.judgment_passed++
      }

      if (r.status === 'completed') agent.completed++
      else if (r.status === 'failed') agent.failed++
      else if (r.status === 'pending') agent.pending++
      else if (r.status === 'timeout') agent.timeout++
    }

    const agents = Array.from(agentMap.values())
      .sort((a, b) => b.total_receipts - a.total_receipts)
      .map(a => ({
        agent_id: a.agent_id,
        total_receipts: a.total_receipts,
        last_active: a.last_active,
        actions: [...a.actions],
        avg_latency_ms: a.latencies.length > 0 ? Math.round(a.latencies.reduce((s, v) => s + v, 0) / a.latencies.length) : 0,
        avg_cost_usd: a.costs.length > 0 ? a.costs.reduce((s, v) => s + v, 0) / a.costs.length : 0,
        total_cost_usd: a.total_cost_usd,
        constraint_pass_rate: a.constraint_evaluated > 0 ? a.constraint_passed / a.constraint_evaluated : 1,
        constraint_evaluated: a.constraint_evaluated,
        constraint_failed: a.constraint_evaluated - a.constraint_passed,
        judgment_count: a.judgment_count,
        judgment_pass_rate: a.judgment_count > 0 ? a.judgment_passed / a.judgment_count : 0,
        receipts_by_status: {
          completed: a.completed,
          failed: a.failed,
          pending: a.pending,
          timeout: a.timeout,
        },
      }))

    return NextResponse.json({ agents })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
