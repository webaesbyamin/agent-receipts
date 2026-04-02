'use client'

import { useStats } from '@/hooks/use-stats'
import { useReceipts } from '@/hooks/use-receipts'
import { useAgents } from '@/hooks/use-agents'
import { StatCard } from '@/components/shared/stat-card'
import { LoadingCards, LoadingTable } from '@/components/shared/loading'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConstraintBadge } from '@/components/shared/constraint-badge'
import { TimeAgo } from '@/components/shared/time-ago'
import { ChartWrapper } from '@/components/shared/chart-wrapper'
import { formatDuration, formatCurrency, formatNumber, formatPercent, truncateId } from '@/lib/formatters'
import { Receipt, Clock, Bot, CheckSquare, Zap, DollarSign, Database } from 'lucide-react'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (active && payload && payload.length) {
    const { name, value } = payload[0]!
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{name}: {value}</p>
      </div>
    )
  }
  return null
}

export default function OverviewPage() {
  const { data: stats, error: statsError, isLoading: statsLoading, mutate: statsRetry } = useStats()
  const { data: recentData, error: recentError } = useReceipts({ limit: 10, sort: 'timestamp:desc' })
  const { data: failuresData } = useReceipts({ limit: 5, status: 'failed', sort: 'timestamp:desc' })
  const { data: agentsData } = useAgents()

  if (statsError) {
    return <ErrorState message={statsError.message} onRetry={() => statsRetry()} />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-text-primary">Overview</h1>

      {/* Stat cards */}
      {statsLoading || !stats ? (
        <LoadingCards count={6} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Receipts" value={formatNumber(stats.total_receipts)} icon={Receipt} />
          <StatCard label="Today" value={formatNumber(stats.receipts_today)} icon={Clock} />
          <StatCard label="Active Agents (7D)" value={formatNumber(stats.active_agents)} icon={Bot} />
          <StatCard label="Pass Rate" value={stats.constraints_evaluated > 0 ? formatPercent(stats.constraint_pass_rate) : '—'} icon={CheckSquare} />
          <StatCard label="Avg Latency" value={formatDuration(stats.avg_latency_ms)} icon={Zap} />
          <StatCard label="Avg Cost" value={formatCurrency(stats.avg_cost_usd)} icon={DollarSign} />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartWrapper title="Receipt Volume (14 days)" loading={!stats}>
          {stats && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.receipt_volume}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={d => d}
                />
                <Area type="monotone" dataKey="count" stroke="var(--primary)" fill="var(--primary-subtle)" name="Receipts" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartWrapper>

        <ChartWrapper title="Constraint Health" loading={!stats}>
          {stats && stats.constraints_evaluated > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Passed', value: stats.constraints_evaluated - stats.constraints_failed },
                    { name: 'Failed', value: stats.constraints_failed },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  dataKey="value"
                >
                  <Cell fill="var(--success)" />
                  <Cell fill="var(--danger)" />
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-text-muted">No constraint data yet</div>
          )}
        </ChartWrapper>
      </div>

      {/* Recent lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Receipts */}
        <div className="card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Recent Receipts</h3>
            <Link href="/receipts" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {recentError ? (
            <div className="p-4 text-sm text-danger">Failed to load</div>
          ) : !recentData ? (
            <LoadingTable rows={5} />
          ) : recentData.data.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No receipts yet"
              description="Create receipts using the MCP server, SDK, or CLI"
            />
          ) : (
            <div className="divide-y divide-border-subtle">
              {recentData.data.map(r => {
                const receipt = r as Record<string, unknown>
                const cr = receipt.constraint_result as { passed?: boolean; results?: unknown[] } | null
                return (
                  <Link
                    key={receipt.receipt_id as string}
                    href={`/receipts/${receipt.receipt_id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-secondary transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-text-secondary">{truncateId(receipt.receipt_id as string)}</code>
                        <span className="text-sm text-text-primary">{receipt.action as string}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-text-muted">{receipt.agent_id as string}</span>
                        <span className="text-xs text-text-muted">{formatDuration(receipt.latency_ms as number | null)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={receipt.status as string} />
                      {cr && Array.isArray(cr.results) && (
                        <ConstraintBadge
                          passed={cr.results.filter((x: unknown) => (x as Record<string, unknown>).passed).length}
                          total={cr.results.length}
                        />
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Failures */}
        <div className="card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Recent Failures</h3>
            <Link href="/receipts?status=failed" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {!failuresData ? (
            <LoadingTable rows={3} />
          ) : failuresData.data.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-text-muted">No failures</div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {failuresData.data.map(r => {
                const receipt = r as Record<string, unknown>
                return (
                  <Link
                    key={receipt.receipt_id as string}
                    href={`/receipts/${receipt.receipt_id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-secondary transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-text-secondary">{truncateId(receipt.receipt_id as string)}</code>
                        <span className="text-sm text-text-primary">{receipt.action as string}</span>
                      </div>
                      <span className="text-xs text-text-muted">{receipt.agent_id as string}</span>
                    </div>
                    <StatusBadge status={receipt.status as string} />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Agent Activity */}
      {agentsData && agentsData.agents.length > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Agent Activity</h3>
            <Link href="/agents" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary">
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Agent</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Receipts</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Last Active</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Pass Rate</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {agentsData.agents.slice(0, 5).map(a => (
                  <tr key={a.agent_id} className="hover:bg-bg-secondary">
                    <td className="px-4 py-2">
                      <Link href={`/agents/${a.agent_id}`} className="font-mono text-xs text-primary hover:underline">
                        {a.agent_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-text-secondary">{formatNumber(a.total_receipts)}</td>
                    <td className="px-4 py-2"><TimeAgo date={a.last_active} className="text-xs" /></td>
                    <td className="px-4 py-2 text-text-secondary">{formatPercent(a.constraint_pass_rate)}</td>
                    <td className="px-4 py-2 text-text-secondary">{formatCurrency(a.total_cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
