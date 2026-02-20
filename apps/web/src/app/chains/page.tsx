'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchReceipts, type PaginatedResponse } from '@/lib/api'
import { DataTable, type Column } from '@/components/shared/data-table'
import { Pagination } from '@/components/shared/pagination'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingTable } from '@/components/shared/loading'
import { TimeAgo } from '@/components/shared/time-ago'
import { ConstraintBadge } from '@/components/shared/constraint-badge'
import { truncateId, formatDuration, formatCurrency } from '@/lib/formatters'
import { Link2 } from 'lucide-react'

interface ChainSummary {
  chain_id: string
  receipt_count: number
  agents: string[]
  started: string
  duration_ms: number
  total_cost: number
  all_completed: boolean
  has_failures: boolean
  constraint_evaluated: number
  constraint_passed: number
}

function ChainsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const [chains, setChains] = useState<ChainSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const result: PaginatedResponse<Record<string, unknown>> = await fetchReceipts({ limit: 100000 })
        const chainMap = new Map<string, { receipts: Record<string, unknown>[] }>()

        for (const r of result.data) {
          const chainId = r.chain_id as string
          if (!chainId) continue
          if (!chainMap.has(chainId)) chainMap.set(chainId, { receipts: [] })
          chainMap.get(chainId)!.receipts.push(r)
        }

        const summaries: ChainSummary[] = []
        for (const [chain_id, { receipts }] of chainMap) {
          if (receipts.length <= 1) continue // skip single-receipt "chains"
          const agents = [...new Set(receipts.map(r => r.agent_id as string))]
          const timestamps = receipts.map(r => new Date(r.timestamp as string).getTime())
          const completed = receipts.filter(r => r.completed_at).map(r => new Date(r.completed_at as string).getTime())
          const started = new Date(Math.min(...timestamps)).toISOString()
          const lastTime = completed.length > 0 ? Math.max(...completed) : Math.max(...timestamps)
          const duration_ms = lastTime - Math.min(...timestamps)

          let constraintEvaluated = 0, constraintPassed = 0
          for (const r of receipts) {
            const cr = r.constraint_result as { passed?: boolean } | null
            if (cr && typeof cr.passed === 'boolean') {
              constraintEvaluated++
              if (cr.passed) constraintPassed++
            }
          }

          summaries.push({
            chain_id,
            receipt_count: receipts.length,
            agents,
            started,
            duration_ms,
            total_cost: receipts.reduce((s, r) => s + ((r.cost_usd as number) ?? 0), 0),
            all_completed: receipts.every(r => r.status === 'completed'),
            has_failures: receipts.some(r => r.status === 'failed' || r.status === 'timeout'),
            constraint_evaluated: constraintEvaluated,
            constraint_passed: constraintPassed,
          })
        }

        summaries.sort((a, b) => b.started.localeCompare(a.started))
        setChains(summaries)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chains')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(chains.length / pageSize))
  const pagedChains = chains.slice((page - 1) * pageSize, page * pageSize)

  const columns: Column<ChainSummary>[] = [
    {
      key: 'chain_id',
      label: 'Chain ID',
      render: c => <code className="font-mono text-xs text-primary">{truncateId(c.chain_id)}</code>,
    },
    {
      key: 'receipt_count',
      label: 'Receipts',
      render: c => <span className="text-sm">{c.receipt_count}</span>,
    },
    {
      key: 'agents',
      label: 'Agents',
      render: c => <span className="text-xs text-text-secondary">{c.agents.join(', ')}</span>,
    },
    {
      key: 'started',
      label: 'Started',
      render: c => <TimeAgo date={c.started} className="text-xs" />,
    },
    {
      key: 'duration_ms',
      label: 'Duration',
      render: c => <span className="text-xs text-text-secondary">{formatDuration(c.duration_ms)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: c => (
        <span className={`text-xs font-medium ${c.has_failures ? 'text-danger' : c.all_completed ? 'text-success' : 'text-warning'}`}>
          {c.has_failures ? 'Has Failures' : c.all_completed ? 'Completed' : 'In Progress'}
        </span>
      ),
    },
    {
      key: 'constraints',
      label: 'Constraints',
      render: c => c.constraint_evaluated > 0
        ? <ConstraintBadge passed={c.constraint_passed} total={c.constraint_evaluated} />
        : <span className="text-text-muted text-xs">—</span>,
    },
    {
      key: 'cost',
      label: 'Cost',
      render: c => <span className="text-xs text-text-secondary">{formatCurrency(c.total_cost)}</span>,
    },
  ]

  if (error) return <ErrorState message={error} />
  if (loading) return <div className="space-y-4"><h1 className="text-lg font-semibold">Chains</h1><LoadingTable rows={8} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Chains</h1>
        <span className="text-sm text-text-muted">{chains.length} chains</span>
      </div>

      {chains.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No chains found"
          description="Chains are created when receipts share a chain_id"
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pagedChains}
            onRowClick={c => router.push(`/chains/${c.chain_id}`)}
            rowKey={c => c.chain_id}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={p => router.push(`/chains?page=${p}`)}
          />
        </>
      )}
    </div>
  )
}

export default function ChainsPage() {
  return (
    <Suspense fallback={<LoadingTable rows={8} />}>
      <ChainsContent />
    </Suspense>
  )
}
