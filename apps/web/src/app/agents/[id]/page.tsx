'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { fetchReceipts, fetchAgents, type AgentSummary, type PaginatedResponse } from '@/lib/api'
import { StatCard } from '@/components/shared/stat-card'
import { DataTable, type Column } from '@/components/shared/data-table'
import { Pagination } from '@/components/shared/pagination'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConstraintBadge } from '@/components/shared/constraint-badge'
import { TimeAgo } from '@/components/shared/time-ago'
import { ChartWrapper } from '@/components/shared/chart-wrapper'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingPage } from '@/components/shared/loading'
import { formatDuration, formatCurrency, formatNumber, formatPercent, truncateId } from '@/lib/formatters'
import { ArrowLeft, Receipt, CheckSquare, DollarSign, Zap } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface ActionBreakdown {
  action: string
  count: number
  pass_rate: number
  avg_cost: number
  avg_latency: number
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [agent, setAgent] = useState<AgentSummary | null>(null)
  const [receipts, setReceipts] = useState<PaginatedResponse<Record<string, unknown>> | null>(null)
  const [actions, setActions] = useState<ActionBreakdown[]>([])
  const [volume, setVolume] = useState<{ date: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [agentsRes, receiptsRes] = await Promise.all([
          fetchAgents(),
          fetchReceipts({ agent_id: id, page, limit: 50, sort: 'timestamp:desc' }),
        ])

        const found = agentsRes.agents.find(a => a.agent_id === id)
        setAgent(found ?? null)
        setReceipts(receiptsRes)

        // Compute action breakdown from all receipts
        const allReceipts = await fetchReceipts({ agent_id: id, limit: 10000 }) // TODO: replace with server-side aggregation in v0.3.0
        const actionMap = new Map<string, { count: number; passed: number; evaluated: number; costs: number[]; latencies: number[] }>()
        for (const r of allReceipts.data) {
          const action = r.action as string
          if (!actionMap.has(action)) actionMap.set(action, { count: 0, passed: 0, evaluated: 0, costs: [], latencies: [] })
          const entry = actionMap.get(action)!
          entry.count++
          const cr = r.constraint_result as { passed?: boolean } | null
          if (cr && typeof cr.passed === 'boolean') {
            entry.evaluated++
            if (cr.passed) entry.passed++
          }
          if (typeof r.cost_usd === 'number') entry.costs.push(r.cost_usd)
          if (typeof r.latency_ms === 'number') entry.latencies.push(r.latency_ms)
        }
        setActions(Array.from(actionMap.entries()).map(([action, d]) => ({
          action,
          count: d.count,
          pass_rate: d.evaluated > 0 ? d.passed / d.evaluated : 1,
          avg_cost: d.costs.length > 0 ? d.costs.reduce((s, v) => s + v, 0) / d.costs.length : 0,
          avg_latency: d.latencies.length > 0 ? Math.round(d.latencies.reduce((s, v) => s + v, 0) / d.latencies.length) : 0,
        })).sort((a, b) => b.count - a.count))

        // Volume chart
        const now = new Date()
        const volMap = new Map<string, number>()
        for (let i = 13; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          volMap.set(d.toISOString().slice(0, 10), 0)
        }
        for (const r of allReceipts.data) {
          const key = (r.timestamp as string).slice(0, 10)
          if (volMap.has(key)) volMap.set(key, (volMap.get(key) ?? 0) + 1)
        }
        setVolume(Array.from(volMap.entries()).map(([date, count]) => ({ date, count })))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, page])

  if (error) return <ErrorState message={error} />
  if (loading || !agent) return <LoadingPage />

  const receiptColumns: Column<Record<string, unknown>>[] = [
    {
      key: 'timestamp',
      label: 'Time',
      render: r => <TimeAgo date={r.timestamp as string} className="text-xs" />,
    },
    {
      key: 'receipt_id',
      label: 'Receipt ID',
      render: r => <code className="font-mono text-xs text-primary">{truncateId(r.receipt_id as string)}</code>,
    },
    {
      key: 'action',
      label: 'Action',
      render: r => <span className="text-sm">{r.action as string}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: r => <StatusBadge status={r.status as string} />,
    },
    {
      key: 'constraints',
      label: 'Constraints',
      render: r => {
        const cr = r.constraint_result as { results?: { passed: boolean }[] } | null
        if (!cr || !Array.isArray(cr.results)) return <span className="text-text-muted text-xs">—</span>
        return <ConstraintBadge passed={cr.results.filter(x => x.passed).length} total={cr.results.length} />
      },
    },
    {
      key: 'latency_ms',
      label: 'Latency',
      render: r => <span className="text-xs text-text-secondary">{formatDuration(r.latency_ms as number | null)}</span>,
    },
    {
      key: 'cost_usd',
      label: 'Cost',
      render: r => <span className="text-xs text-text-secondary">{formatCurrency(r.cost_usd as number | null)}</span>,
    },
  ]

  return (
    <div className="space-y-4 max-w-5xl">
      <Link href="/agents" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary">
        <ArrowLeft className="w-4 h-4" /> Back to Agents
      </Link>

      <div>
        <h1 className="font-mono text-lg font-semibold text-text-primary">{agent.agent_id}</h1>
        <p className="text-sm text-text-muted">{formatNumber(agent.total_receipts)} receipts · Last active <TimeAgo date={agent.last_active} /></p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Receipts" value={formatNumber(agent.total_receipts)} icon={Receipt} />
        <StatCard label="Pass Rate" value={agent.constraint_evaluated > 0 ? formatPercent(agent.constraint_pass_rate) : '—'} icon={CheckSquare} />
        <StatCard label="Avg Cost" value={formatCurrency(agent.avg_cost_usd)} icon={DollarSign} />
        <StatCard label="Avg Latency" value={formatDuration(agent.avg_latency_ms)} icon={Zap} />
      </div>

      {/* Actions breakdown */}
      {actions.length > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text-primary">Actions Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary">
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Action</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Count</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Pass Rate</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Avg Cost</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {actions.map(a => (
                  <tr key={a.action} className="hover:bg-bg-secondary">
                    <td className="px-4 py-2 font-medium">{a.action}</td>
                    <td className="px-4 py-2 text-text-secondary">{formatNumber(a.count)}</td>
                    <td className="px-4 py-2 text-text-secondary">{formatPercent(a.pass_rate)}</td>
                    <td className="px-4 py-2 text-text-secondary">{formatCurrency(a.avg_cost)}</td>
                    <td className="px-4 py-2 text-text-secondary">{formatDuration(a.avg_latency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chart */}
      <ChartWrapper title="Receipts / Day (14 days)" loading={false}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={volume}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="count" stroke="var(--primary)" fill="var(--primary-subtle)" name="Receipts" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartWrapper>

      {/* Recent Receipts */}
      {receipts && receipts.data.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Recent Receipts</h3>
          </div>
          <DataTable
            columns={receiptColumns}
            data={receipts.data}
            onRowClick={r => router.push(`/receipts/${r.receipt_id}`)}
            rowKey={r => r.receipt_id as string}
          />
          <Pagination
            page={receipts.pagination.page}
            totalPages={receipts.pagination.total_pages}
            onPageChange={p => setPage(p)}
          />
        </>
      )}
    </div>
  )
}
