'use client'

import { Suspense } from 'react'
import useSWR from 'swr'
import { StatCard } from '@/components/shared/stat-card'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingPage } from '@/components/shared/loading'
import { formatNumber } from '@/lib/formatters'
import { Brain, Eye, Link2, Trash2 } from 'lucide-react'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'

interface AuditReport {
  total_entities: number
  total_observations: number
  total_relationships: number
  forgotten_observations: number
  forgotten_entities: number
  by_entity_type: Record<string, number>
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

function AuditContent() {
  const { refreshInterval } = useAutoRefresh()
  const { data, error, mutate } = useSWR<AuditReport>('/api/memory/audit', fetcher, { refreshInterval })

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />
  if (!data) return <LoadingPage />

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Memory Audit</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Entities" value={formatNumber(data.total_entities)} icon={Brain} />
        <StatCard label="Total Observations" value={formatNumber(data.total_observations)} icon={Eye} />
        <StatCard label="Total Relationships" value={formatNumber(data.total_relationships)} icon={Link2} />
        <StatCard label="Forgotten Obs" value={formatNumber(data.forgotten_observations)} icon={Trash2} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text-primary">Summary</h3>
          </div>
          <div className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Active Entities</span>
              <span className="text-text-primary font-medium">{data.total_entities - data.forgotten_entities}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Forgotten Entities</span>
              <span className="text-text-primary font-medium">{data.forgotten_entities}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Active Observations</span>
              <span className="text-text-primary font-medium">{data.total_observations - data.forgotten_observations}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Forgotten Observations</span>
              <span className="text-text-primary font-medium">{data.forgotten_observations}</span>
            </div>
          </div>
        </div>

        {Object.keys(data.by_entity_type).length > 0 && (
          <div className="card">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium text-text-primary">By Entity Type</h3>
            </div>
            <div className="p-4 space-y-2 text-sm">
              {Object.entries(data.by_entity_type)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex justify-between">
                    <span className="text-text-secondary">{type}</span>
                    <span className="text-text-primary font-medium">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MemoryAuditPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <AuditContent />
    </Suspense>
  )
}
