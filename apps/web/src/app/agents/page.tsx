'use client'

import { useRouter } from 'next/navigation'
import { useAgents } from '@/hooks/use-agents'
import { DataTable, type Column } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingTable } from '@/components/shared/loading'
import { TimeAgo } from '@/components/shared/time-ago'
import { formatDuration, formatCurrency, formatNumber, formatPercent } from '@/lib/formatters'
import { Bot } from 'lucide-react'
import type { AgentSummary } from '@/lib/api'

export default function AgentsPage() {
  const router = useRouter()
  const { data, error, isLoading, mutate } = useAgents()

  const columns: Column<AgentSummary>[] = [
    {
      key: 'agent_id',
      label: 'Agent',
      render: a => <code className="font-mono text-xs text-primary">{a.agent_id}</code>,
    },
    {
      key: 'total_receipts',
      label: 'Receipts',
      render: a => <span className="text-sm">{formatNumber(a.total_receipts)}</span>,
    },
    {
      key: 'last_active',
      label: 'Last Active',
      render: a => <TimeAgo date={a.last_active} className="text-xs" />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: a => <span className="text-xs text-text-secondary">{a.actions.slice(0, 3).join(', ')}{a.actions.length > 3 ? ` +${a.actions.length - 3}` : ''}</span>,
    },
    {
      key: 'avg_latency_ms',
      label: 'Avg Latency',
      render: a => <span className="text-xs text-text-secondary">{formatDuration(a.avg_latency_ms)}</span>,
    },
    {
      key: 'avg_cost_usd',
      label: 'Avg Cost',
      render: a => <span className="text-xs text-text-secondary">{formatCurrency(a.avg_cost_usd)}</span>,
    },
    {
      key: 'constraint_pass_rate',
      label: 'Pass Rate',
      render: a => <span className="text-xs text-text-secondary">{a.constraint_evaluated > 0 ? formatPercent(a.constraint_pass_rate) : '—'}</span>,
    },
    {
      key: 'judgment_count',
      label: 'Judgments',
      render: a => <span className="text-xs text-text-secondary">{a.judgment_count > 0 ? formatNumber(a.judgment_count) : '—'}</span>,
    },
  ]

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Agents</h1>

      {isLoading ? (
        <LoadingTable rows={5} />
      ) : !data || data.agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents found"
          description="Agents appear here when receipts are created"
        />
      ) : (
        <DataTable
          columns={columns}
          data={data.agents}
          onRowClick={a => router.push(`/agents/${a.agent_id}`)}
          rowKey={a => a.agent_id}
        />
      )}
    </div>
  )
}
