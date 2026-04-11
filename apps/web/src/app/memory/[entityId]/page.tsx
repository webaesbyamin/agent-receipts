'use client'

import { use } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingPage } from '@/components/shared/loading'
import { TimeAgo } from '@/components/shared/time-ago'
import { ArrowLeft, Brain, Eye, Link2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'

interface Observation {
  observation_id: string
  entity_id: string
  content: string
  confidence: string
  source_receipt_id: string
  source_agent_id: string
  source_context: string | null
  observed_at: string
  forgotten_at: string | null
  forgotten_by: string | null
  superseded_by: string | null
  tags: string[]
}

interface Relationship {
  relationship_id: string
  from_entity_id: string
  to_entity_id: string
  relationship_type: string
  strength: string
  created_at: string
  forgotten_at: string | null
}

interface Entity {
  entity_id: string
  entity_type: string
  name: string
  aliases: string[]
  scope: string
  created_at: string
  created_by_agent: string
  forgotten_at: string | null
  merged_into: string | null
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

const CONFIDENCE_COLORS: Record<string, string> = {
  certain: 'bg-green-100 text-green-700',
  high: 'bg-blue-100 text-blue-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-orange-100 text-orange-700',
  deprecated: 'bg-red-100 text-red-700',
}

export default function EntityDetailPage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = use(params)
  const { refreshInterval } = useAutoRefresh()

  const { data, error, mutate } = useSWR<{
    entity: Entity
    observations: Observation[]
    relationships: Relationship[]
  }>(`/api/memory/entities/${entityId}`, fetcher, { refreshInterval })

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />
  if (!data) return <LoadingPage />

  const activeObs = data.observations.filter(o => !o.forgotten_at)
  const forgottenObs = data.observations.filter(o => o.forgotten_at)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/memory" className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-text-primary">{data.entity.name}</h1>
            <span className="px-2 py-0.5 rounded-full text-xs bg-bg-tertiary text-text-secondary">
              {data.entity.entity_type}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-bg-tertiary text-text-muted">
              {data.entity.scope}
            </span>
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            <code className="font-mono">{data.entity.entity_id}</code>
            {' '}&middot; Created by {data.entity.created_by_agent}
            {' '}&middot; <TimeAgo date={data.entity.created_at} />
          </div>
        </div>
      </div>

      {data.entity.aliases.length > 0 && (
        <div className="text-xs text-text-secondary">
          Also known as: {data.entity.aliases.join(', ')}
        </div>
      )}

      {data.entity.forgotten_at && (
        <div className="px-3 py-2 rounded-md bg-red-50 text-red-700 text-sm">
          This entity has been forgotten
        </div>
      )}

      {/* Observations */}
      <div className="card">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Eye className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-medium text-text-primary">
            Observations ({activeObs.length})
          </h3>
        </div>
        <div className="divide-y divide-border-subtle">
          {activeObs.map(obs => (
            <div key={obs.observation_id} className="px-4 py-3">
              <div className="text-sm text-text-primary mb-1">{obs.content}</div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className={cn('px-1.5 py-0.5 rounded text-xs', CONFIDENCE_COLORS[obs.confidence] ?? 'bg-bg-tertiary text-text-muted')}>
                  {obs.confidence}
                </span>
                <span>by {obs.source_agent_id}</span>
                <TimeAgo date={obs.observed_at} />
                {obs.tags.length > 0 && (
                  <span>{obs.tags.map(t => `#${t}`).join(' ')}</span>
                )}
                <Link href={`/receipts/${obs.source_receipt_id}`} className="text-primary hover:underline ml-auto">
                  receipt
                </Link>
              </div>
            </div>
          ))}
          {activeObs.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-text-muted">No active observations</div>
          )}
        </div>
      </div>

      {/* Relationships */}
      {data.relationships.length > 0 && (
        <div className="card">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Link2 className="w-4 h-4 text-text-muted" />
            <h3 className="text-sm font-medium text-text-primary">
              Relationships ({data.relationships.length})
            </h3>
          </div>
          <div className="divide-y divide-border-subtle">
            {data.relationships.map(rel => (
              <div key={rel.relationship_id} className="px-4 py-3 flex items-center gap-2 text-sm">
                <Link href={`/memory/${rel.from_entity_id}`} className="text-primary hover:underline font-mono text-xs">
                  {rel.from_entity_id === entityId ? 'this' : rel.from_entity_id}
                </Link>
                <span className="text-text-secondary">{rel.relationship_type}</span>
                <Link href={`/memory/${rel.to_entity_id}`} className="text-primary hover:underline font-mono text-xs">
                  {rel.to_entity_id === entityId ? 'this' : rel.to_entity_id}
                </Link>
                <span className={cn('px-1.5 py-0.5 rounded text-xs ml-2', CONFIDENCE_COLORS[rel.strength] ?? 'bg-bg-tertiary text-text-muted')}>
                  {rel.strength}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forgotten observations */}
      {forgottenObs.length > 0 && (
        <div className="card opacity-60">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text-muted">
              Forgotten Observations ({forgottenObs.length})
            </h3>
          </div>
          <div className="divide-y divide-border-subtle">
            {forgottenObs.map(obs => (
              <div key={obs.observation_id} className="px-4 py-3">
                <div className="text-sm text-text-muted line-through mb-1">{obs.content}</div>
                <div className="text-xs text-text-muted">
                  Forgotten <TimeAgo date={obs.forgotten_at!} />
                  {obs.forgotten_by && ` by ${obs.forgotten_by}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
