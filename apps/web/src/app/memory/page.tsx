'use client'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { StatCard } from '@/components/shared/stat-card'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingPage } from '@/components/shared/loading'
import { TimeAgo } from '@/components/shared/time-ago'
import { formatNumber } from '@/lib/formatters'
import { Brain, Eye, Link2, Trash2 } from 'lucide-react'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'

interface EntityWithCounts {
  entity_id: string
  entity_type: string
  name: string
  aliases: string[]
  scope: string
  created_at: string
  observation_count: number
  latest_observation: string | null
}

interface AuditReport {
  total_entities: number
  total_observations: number
  total_relationships: number
  forgotten_observations: number
  forgotten_entities: number
  by_entity_type: Record<string, number>
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

function MemoryContent() {
  const router = useRouter()
  const { refreshInterval } = useAutoRefresh()
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  const queryParams = new URLSearchParams()
  if (typeFilter) queryParams.set('entity_type', typeFilter)
  if (search) queryParams.set('query', search)

  const { data, error, mutate } = useSWR<{ entities: EntityWithCounts[]; pagination: { total: number } }>(
    `/api/memory/entities?${queryParams.toString()}`,
    fetcher,
    { refreshInterval }
  )

  const { data: audit } = useSWR<AuditReport>('/api/memory/audit', fetcher, { refreshInterval })

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />
  if (!data) return <LoadingPage />

  const entityTypes = ['person', 'project', 'organization', 'preference', 'fact', 'context', 'tool', 'custom']

  if (data.pagination.total === 0 && !audit) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-text-primary">Memory</h1>
        <EmptyState
          icon={Brain}
          title="No memories yet"
          description="Use memory_observe via MCP tools, SDK, or CLI to store your first memory"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Memory</h1>

      {audit && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Entities" value={formatNumber(audit.total_entities)} icon={Brain} />
          <StatCard label="Observations" value={formatNumber(audit.total_observations)} icon={Eye} />
          <StatCard label="Relationships" value={formatNumber(audit.total_relationships)} icon={Link2} />
          <StatCard label="Forgotten" value={formatNumber(audit.forgotten_observations)} icon={Trash2} />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search entities..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-bg-primary text-text-primary placeholder:text-text-muted w-64"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-md bg-bg-primary text-text-primary"
        >
          <option value="">All types</option>
          {entityTypes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Entity list */}
      <div className="card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">
            Entities ({data.pagination.total})
          </h3>
        </div>
        <div className="divide-y divide-border-subtle">
          {data.entities.map(entity => (
            <div
              key={entity.entity_id}
              className="px-4 py-3 hover:bg-bg-secondary transition-colors cursor-pointer"
              onClick={() => router.push(`/memory/${entity.entity_id}`)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-text-primary">{entity.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-bg-tertiary text-text-secondary">
                    {entity.entity_type}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-bg-tertiary text-text-muted">
                    {entity.scope}
                  </span>
                </div>
                <span className="text-xs text-text-secondary">
                  {entity.observation_count} observation{entity.observation_count !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <code className="font-mono">{entity.entity_id}</code>
                {entity.aliases.length > 0 && (
                  <span>aka: {entity.aliases.join(', ')}</span>
                )}
                {entity.latest_observation && (
                  <span className="ml-auto">
                    Last observed: <TimeAgo date={entity.latest_observation} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Entity type breakdown */}
      {audit && Object.keys(audit.by_entity_type).length > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text-primary">By Entity Type</h3>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(audit.by_entity_type).map(([type, count]) => (
              <div
                key={type}
                className="px-3 py-2 rounded-md bg-bg-secondary text-center cursor-pointer hover:bg-bg-tertiary"
                onClick={() => setTypeFilter(type)}
              >
                <div className="text-lg font-semibold text-text-primary">{count}</div>
                <div className="text-xs text-text-muted">{type}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MemoryPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <MemoryContent />
    </Suspense>
  )
}
