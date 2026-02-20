'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchReceipts, type PaginatedResponse } from '@/lib/api'
import { StatCard } from '@/components/shared/stat-card'
import { ChartWrapper } from '@/components/shared/chart-wrapper'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { LoadingPage } from '@/components/shared/loading'
import { formatNumber, formatPercent } from '@/lib/formatters'
import { CONSTRAINT_TYPES } from '@/lib/constants'
import { CheckSquare, TrendingUp, XCircle, BarChart3 } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ConstraintTypeStats {
  type: string
  used: number
  passed: number
  failed: number
}

interface FailureReason {
  type: string
  agent: string
  action: string
  count: number
}

export default function ConstraintsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [evaluated, setEvaluated] = useState(0)
  const [passRate, setPassRate] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [mostUsed, setMostUsed] = useState('—')
  const [typeStats, setTypeStats] = useState<ConstraintTypeStats[]>([])
  const [failures, setFailures] = useState<FailureReason[]>([])
  const [trend, setTrend] = useState<{ date: string; pass_rate: number }[]>([])

  useEffect(() => {
    async function load() {
      try {
        const result: PaginatedResponse<Record<string, unknown>> = await fetchReceipts({ limit: 100000 })
        const receipts = result.data

        const typeCounts = new Map<string, { used: number; passed: number; failed: number }>()
        const failMap = new Map<string, { type: string; agent: string; action: string; count: number }>()
        let totalEvaluated = 0, totalPassed = 0

        const now = new Date()
        const trendMap = new Map<string, { passed: number; total: number }>()
        for (let i = 13; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
          trendMap.set(d.toISOString().slice(0, 10), { passed: 0, total: 0 })
        }

        for (const r of receipts) {
          const cr = r.constraint_result as { passed?: boolean; results?: { type: string; passed: boolean }[] } | null
          if (!cr || !Array.isArray(cr.results)) continue

          totalEvaluated++
          if (cr.passed) totalPassed++

          const dateKey = (r.timestamp as string).slice(0, 10)
          if (trendMap.has(dateKey)) {
            const entry = trendMap.get(dateKey)!
            entry.total++
            if (cr.passed) entry.passed++
          }

          for (const c of cr.results) {
            if (!typeCounts.has(c.type)) typeCounts.set(c.type, { used: 0, passed: 0, failed: 0 })
            const tc = typeCounts.get(c.type)!
            tc.used++
            if (c.passed) tc.passed++
            else {
              tc.failed++
              const key = `${c.type}|${r.agent_id}|${r.action}`
              if (!failMap.has(key)) failMap.set(key, { type: c.type, agent: r.agent_id as string, action: r.action as string, count: 0 })
              failMap.get(key)!.count++
            }
          }
        }

        setEvaluated(totalEvaluated)
        setPassRate(totalEvaluated > 0 ? totalPassed / totalEvaluated : 1)
        setFailedCount(totalEvaluated - totalPassed)

        const statsArr = Array.from(typeCounts.entries()).map(([type, d]) => ({ type, ...d })).sort((a, b) => b.used - a.used)
        setTypeStats(statsArr)
        setMostUsed(statsArr[0]?.type ?? '—')

        setFailures(Array.from(failMap.values()).sort((a, b) => b.count - a.count).slice(0, 10))
        setTrend(Array.from(trendMap.entries()).map(([date, d]) => ({
          date,
          pass_rate: d.total > 0 ? d.passed / d.total * 100 : 100,
        })))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (error) return <ErrorState message={error} />
  if (loading) return <LoadingPage />

  if (evaluated === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-text-primary">Constraints</h1>
        <EmptyState
          icon={CheckSquare}
          title="No constraints evaluated yet"
          description="Add constraints to track_action or create_receipt calls"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Constraints</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Evaluated" value={formatNumber(evaluated)} icon={CheckSquare} />
        <StatCard label="Pass Rate" value={formatPercent(passRate)} icon={TrendingUp} />
        <StatCard label="Failed" value={formatNumber(failedCount)} icon={XCircle} />
        <StatCard label="Most Used" value={CONSTRAINT_TYPES[mostUsed] ?? mostUsed} icon={BarChart3} />
      </div>

      {/* Type breakdown */}
      <div className="card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">Pass/Fail by Constraint Type</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary">
                <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Constraint Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Used</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Passed</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Failed</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Pass Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {typeStats.map(ts => (
                <tr key={ts.type} className="hover:bg-bg-secondary">
                  <td className="px-4 py-2 font-medium">{CONSTRAINT_TYPES[ts.type] ?? ts.type}</td>
                  <td className="px-4 py-2 text-text-secondary">{formatNumber(ts.used)}</td>
                  <td className="px-4 py-2 text-success">{formatNumber(ts.passed)}</td>
                  <td className="px-4 py-2 text-danger">{formatNumber(ts.failed)}</td>
                  <td className="px-4 py-2 text-text-secondary">{formatPercent(ts.used > 0 ? ts.passed / ts.used : 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failure analysis */}
      {failures.length > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">Failure Analysis</h3>
            <Link href="/receipts?constraint_passed=false" className="text-xs text-primary hover:underline">View all failed receipts</Link>
          </div>
          <div className="p-4 space-y-2">
            {failures.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-text-muted w-6">{i + 1}.</span>
                <code className="text-xs bg-danger-subtle text-danger px-1.5 py-0.5 rounded">{f.type}</code>
                <span className="text-text-secondary">on {f.agent}/{f.action}</span>
                <span className="text-text-muted ml-auto">({f.count}x)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend chart */}
      <ChartWrapper title="Pass Rate Trend (14 days)" loading={false}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d.slice(5)} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}%`} />
            <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Pass Rate']} />
            <Area type="monotone" dataKey="pass_rate" stroke="var(--success)" fill="var(--success-subtle)" name="Pass Rate" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  )
}
