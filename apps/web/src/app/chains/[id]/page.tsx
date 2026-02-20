'use client'

import { use } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { fetchChain, type ChainResponse, type ChainNode } from '@/lib/api'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { TimeAgo } from '@/components/shared/time-ago'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingPage } from '@/components/shared/loading'
import { CopyButton } from '@/components/shared/copy-button'
import { formatDuration, formatCurrency, formatNumber, truncateId, formatPercent } from '@/lib/formatters'
import { ArrowLeft, Clock, DollarSign, Users, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/cn'

function TreeNode({ node, currentId, depth = 0 }: { node: ChainNode; currentId?: string; depth?: number }) {
  const r = node.receipt
  const isCurrent = r.receipt_id === currentId
  return (
    <div style={{ marginLeft: depth * 24 }}>
      <Link
        href={`/receipts/${r.receipt_id}`}
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded hover:bg-bg-secondary transition-colors',
          isCurrent && 'bg-primary-subtle'
        )}
      >
        <div className={cn('w-2 h-2 rounded-full shrink-0', isCurrent ? 'bg-primary' : 'bg-text-muted')} />
        <code className="font-mono text-xs text-primary">{truncateId(r.receipt_id as string)}</code>
        <span className="text-xs text-text-secondary">{r.action as string}</span>
        <span className="text-xs text-text-muted">[{r.agent_id as string}]</span>
        <StatusBadge status={r.status as string} />
        {typeof r.latency_ms === 'number' && (
          <span className="text-xs text-text-muted ml-auto">{formatDuration(r.latency_ms)}</span>
        )}
      </Link>
      {node.children.map(child => (
        <TreeNode key={(child.receipt as Record<string, unknown>).receipt_id as string} node={child} currentId={currentId} depth={depth + 1} />
      ))}
    </div>
  )
}

export default function ChainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, error, mutate } = useSWR<ChainResponse>(`chain-${id}`, () => fetchChain(id))

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />
  if (!data) return <LoadingPage />

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/chains" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary">
        <ArrowLeft className="w-4 h-4" /> Back to Chains
      </Link>

      <div className="flex items-center gap-2">
        <code className="font-mono text-lg font-semibold text-text-primary">{data.chain_id}</code>
        <CopyButton value={data.chain_id} />
        <span className="text-sm text-text-muted ml-2">{data.receipts.length} receipts</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Duration" value={formatDuration(data.total_duration_ms)} icon={Clock} />
        <StatCard label="Total Cost" value={formatCurrency(data.total_cost_usd)} icon={DollarSign} />
        <StatCard label="Agents" value={formatNumber(data.agents.length)} icon={Users} />
        <StatCard label="Constraint Pass Rate" value={formatPercent(data.constraint_pass_rate)} icon={CheckSquare} />
      </div>

      {/* Timeline */}
      <div className="card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">Timeline</h3>
        </div>
        <div className="p-4 overflow-x-auto">
          <div className="flex items-center gap-4 min-w-max">
            {(data.receipts as Record<string, unknown>[])
              .sort((a, b) => (a.timestamp as string).localeCompare(b.timestamp as string))
              .map((r, i) => (
                <div key={r.receipt_id as string} className="flex items-center gap-2">
                  {i > 0 && <div className="w-8 h-0.5 bg-border" />}
                  <Link
                    href={`/receipts/${r.receipt_id}`}
                    className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary-subtle transition-colors min-w-[120px]"
                  >
                    <StatusBadge status={r.status as string} />
                    <span className="text-xs font-medium text-text-primary">{r.action as string}</span>
                    <span className="text-xs text-text-muted">{r.agent_id as string}</span>
                    {typeof r.latency_ms === 'number' && (
                      <span className="text-xs text-text-muted">{formatDuration(r.latency_ms)}</span>
                    )}
                  </Link>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Tree */}
      <div className="card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">Tree</h3>
        </div>
        <div className="p-4">
          {data.tree.length > 0 ? (
            data.tree.map(node => (
              <TreeNode key={(node.receipt as Record<string, unknown>).receipt_id as string} node={node} />
            ))
          ) : (
            // Flat list fallback if tree building failed
            (data.receipts as Record<string, unknown>[]).map(r => (
              <Link
                key={r.receipt_id as string}
                href={`/receipts/${r.receipt_id}`}
                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-bg-secondary"
              >
                <div className="w-2 h-2 rounded-full bg-text-muted" />
                <code className="font-mono text-xs text-primary">{truncateId(r.receipt_id as string)}</code>
                <span className="text-xs text-text-secondary">{r.action as string}</span>
                <StatusBadge status={r.status as string} />
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Agents involved */}
      <div className="card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">Agents Involved</h3>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {data.agents.map(a => (
            <Link
              key={a}
              href={`/agents/${a}`}
              className="px-3 py-1.5 text-xs font-mono bg-bg-secondary border border-border rounded-md text-primary hover:bg-primary-subtle transition-colors"
            >
              {a}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
