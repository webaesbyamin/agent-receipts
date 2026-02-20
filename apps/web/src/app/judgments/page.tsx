'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { fetchJudgments, fetchReceipts, type PaginatedResponse } from '@/lib/api'
import { StatCard } from '@/components/shared/stat-card'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingPage } from '@/components/shared/loading'
import { TimeAgo } from '@/components/shared/time-ago'
import { formatNumber, formatPercent, truncateId } from '@/lib/formatters'
import { VERDICT_COLORS } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { Scale, TrendingUp, Hash, Users } from 'lucide-react'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'
import { useEffect, useState } from 'react'

function JudgmentsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshInterval } = useAutoRefresh()
  const page = parseInt(searchParams.get('page') ?? '1', 10)

  const { data, error, mutate } = useSWR<PaginatedResponse<Record<string, unknown>>>(
    `judgments-page-${page}`,
    () => fetchJudgments({ page, limit: 50 }),
    { refreshInterval }
  )

  const [stats, setStats] = useState<{ total: number; passRate: number; avgScore: number; judges: number } | null>(null)
  const [criteria, setCriteria] = useState<{ criterion: string; avgScore: number; count: number }[]>([])

  useEffect(() => {
    async function loadStats() {
      try {
        const all = await fetchJudgments({ limit: 100000 })
        const judgments = all.data
        let passed = 0, totalScore = 0, scoreCount = 0
        const judgesSet = new Set<string>()
        const criteriaMap = new Map<string, { total: number; count: number }>()

        for (const j of judgments) {
          const meta = j.metadata as Record<string, unknown> | null
          if (meta?.verdict === 'pass') passed++
          if (typeof meta?.score === 'number') {
            totalScore += meta.score as number
            scoreCount++
          }
          if (typeof j.model === 'string' && j.model) judgesSet.add(j.model)

          const criteriaArr = meta?.criteria as { criterion: string; score: number }[] | undefined
          if (Array.isArray(criteriaArr)) {
            for (const c of criteriaArr) {
              if (!criteriaMap.has(c.criterion)) criteriaMap.set(c.criterion, { total: 0, count: 0 })
              const entry = criteriaMap.get(c.criterion)!
              entry.total += c.score
              entry.count++
            }
          }
        }

        setStats({
          total: judgments.length,
          passRate: judgments.length > 0 ? passed / judgments.length : 0,
          avgScore: scoreCount > 0 ? totalScore / scoreCount : 0,
          judges: judgesSet.size,
        })

        setCriteria(
          Array.from(criteriaMap.entries())
            .map(([criterion, d]) => ({ criterion, avgScore: d.total / d.count, count: d.count }))
            .sort((a, b) => b.count - a.count)
        )
      } catch {}
    }
    loadStats()
  }, [])

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />
  if (!data) return <LoadingPage />

  if (data.pagination.total === 0 && !stats) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-text-primary">Judgments</h1>
        <EmptyState
          icon={Scale}
          title="No judgments yet"
          description="Use the judge_receipt MCP tool or SDK to create judgments"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Judgments</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Judgments" value={formatNumber(stats.total)} icon={Scale} />
          <StatCard label="Pass Rate" value={formatPercent(stats.passRate)} icon={TrendingUp} />
          <StatCard label="Avg Score" value={stats.avgScore.toFixed(2)} icon={Hash} />
          <StatCard label="Judges Used" value={formatNumber(stats.judges)} icon={Users} />
        </div>
      )}

      {/* Criteria */}
      {criteria.length > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text-primary">Scores by Criteria</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary">
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Criterion</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Avg Score</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {criteria.map(c => (
                  <tr key={c.criterion} className="hover:bg-bg-secondary">
                    <td className="px-4 py-2 font-medium">{c.criterion}</td>
                    <td className="px-4 py-2 text-text-secondary">{c.avgScore.toFixed(2)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${c.avgScore * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-muted">{(c.avgScore * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent judgments */}
      <div className="card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">Recent Judgments</h3>
        </div>
        <div className="divide-y divide-border-subtle">
          {data.data.map(j => {
            const meta = j.metadata as Record<string, unknown> | null
            const verdict = meta?.verdict as string | undefined
            const score = meta?.score as number | undefined
            const parentId = j.parent_receipt_id as string | null
            const verdictColors = VERDICT_COLORS[verdict ?? ''] ?? { bg: 'bg-bg-tertiary', text: 'text-text-secondary' }

            return (
              <div key={j.receipt_id as string} className="px-4 py-3 hover:bg-bg-secondary transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-text-muted">For:</span>
                    {parentId ? (
                      <Link href={`/receipts/${parentId}`} className="font-mono text-xs text-primary hover:underline">
                        {truncateId(parentId)}
                      </Link>
                    ) : (
                      <span className="text-xs text-text-muted">unknown</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {verdict && (
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium uppercase', verdictColors.bg, verdictColors.text)}>
                        {verdict} {score !== undefined && `(${score.toFixed(2)})`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span>Judge: {(j.model as string) ?? 'unknown'}</span>
                  <TimeAgo date={j.timestamp as string} />
                  <Link href={`/receipts/${j.receipt_id}`} className="text-primary hover:underline ml-auto">
                    View judgment receipt
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <Pagination
        page={data.pagination.page}
        totalPages={data.pagination.total_pages}
        onPageChange={p => router.push(`/judgments?page=${p}`)}
      />
    </div>
  )
}

export default function JudgmentsPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <JudgmentsContent />
    </Suspense>
  )
}
