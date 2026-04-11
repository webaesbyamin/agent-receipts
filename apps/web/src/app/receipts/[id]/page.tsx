'use client'

import { use } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { fetchReceipt, type ReceiptDetailResponse } from '@/lib/api'
import { StatusBadge } from '@/components/shared/status-badge'
import { ConstraintBadge } from '@/components/shared/constraint-badge'
import { CopyButton } from '@/components/shared/copy-button'
import { HashDisplay } from '@/components/shared/hash-display'
import { TimeAgo } from '@/components/shared/time-ago'
import { JsonViewer } from '@/components/shared/json-viewer'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingPage } from '@/components/shared/loading'
import { formatDuration, formatCurrency, formatDate, formatNumber, truncateId } from '@/lib/formatters'
import { VERDICT_COLORS } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { ArrowLeft, Check, X, ShieldCheck, ShieldX, Info, Brain } from 'lucide-react'

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

function DetailRow({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 py-2">
      <span className="text-xs text-text-muted w-28 shrink-0 pt-0.5">{label}</span>
      <div className={cn('text-sm text-text-primary min-w-0 flex-1', mono && 'font-mono text-xs')}>{children}</div>
    </div>
  )
}

function Section({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        {badge}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  )
}

function MemorySection({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata?.memory) return null
  const mem = metadata.memory as Record<string, unknown>
  const memOp = String(mem.memory_operation ?? '')
  const memEntityId = mem.entity_id ? String(mem.entity_id) : null
  const memObsId = mem.observation_id ? String(mem.observation_id) : null
  const memScope = mem.scope ? String(mem.scope) : null
  const memConfidence = mem.confidence ? String(mem.confidence) : null
  const memQuery = mem.query ? String(mem.query) : null
  const memResultsCount = mem.results_count != null ? String(mem.results_count) : null

  return (
    <Section title="Memory Operation" badge={
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
        <Brain className="w-3 h-3" />
        {memOp}
      </span>
    }>
      {memEntityId && (
        <DetailRow label="Entity">
          <Link href={`/memory/${memEntityId}`} className="text-primary hover:underline font-mono text-xs">
            {memEntityId}
          </Link>
        </DetailRow>
      )}
      {memObsId && (
        <DetailRow label="Observation" mono>{memObsId}</DetailRow>
      )}
      {memScope && (
        <DetailRow label="Scope"><span className="capitalize">{memScope}</span></DetailRow>
      )}
      {memConfidence && (
        <DetailRow label="Confidence"><span className="capitalize">{memConfidence}</span></DetailRow>
      )}
      {memQuery && (
        <DetailRow label="Query"><span className="italic">&ldquo;{memQuery}&rdquo;</span></DetailRow>
      )}
      {memResultsCount !== null && (
        <DetailRow label="Results">{memResultsCount}</DetailRow>
      )}
    </Section>
  )
}

export default function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, error, mutate } = useSWR<ReceiptDetailResponse>(
    `receipt-${id}`,
    () => fetchReceipt(id),
    { revalidateOnFocus: true }
  )

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />
  if (!data) return <LoadingPage />

  const receipt = data.receipt as Record<string, unknown>
  const cr = receipt.constraint_result as { passed?: boolean; results?: { type: string; passed: boolean; expected: unknown; actual: unknown; message?: string }[]; evaluated_at?: string } | null
  const constraints = receipt.constraints as { definitions?: { type: string; value: unknown; message?: string }[] } | null
  const metadata = receipt.metadata as Record<string, unknown> | null
  const expiresAt = metadata?.expires_at as string | undefined

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Back */}
      <Link href="/receipts" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary">
        <ArrowLeft className="w-4 h-4" /> Back to Receipts
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <code className="font-mono text-lg font-semibold text-text-primary">{receipt.receipt_id as string}</code>
            <CopyButton value={receipt.receipt_id as string} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={receipt.status as string} />
          {cr && Array.isArray(cr.results) && (
            <ConstraintBadge passed={cr.results.filter(x => x.passed).length} total={cr.results.length} />
          )}
          {isDemoMode ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
              <Info className="w-3 h-3" />
              Demo Signature
            </span>
          ) : (
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              data.verified ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'
            )}>
              {data.verified ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
              {data.verified ? 'Verified' : 'Unverified'}
            </span>
          )}
        </div>
      </div>

      {/* Identity */}
      <Section title="Identity">
        <DetailRow label="Receipt ID" mono>
          <span className="inline-flex items-center gap-1">
            {receipt.receipt_id as string} <CopyButton value={receipt.receipt_id as string} />
          </span>
        </DetailRow>
        <DetailRow label="Chain ID" mono>
          {receipt.chain_id ? (
            <Link href={`/chains/${receipt.chain_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
              {receipt.chain_id as string} <CopyButton value={receipt.chain_id as string} />
            </Link>
          ) : '—'}
        </DetailRow>
        <DetailRow label="Parent" mono>
          {receipt.parent_receipt_id ? (
            <Link href={`/receipts/${receipt.parent_receipt_id}`} className="text-primary hover:underline inline-flex items-center gap-1">
              {receipt.parent_receipt_id as string} <CopyButton value={receipt.parent_receipt_id as string} />
            </Link>
          ) : '—'}
        </DetailRow>
        <DetailRow label="Type">{receipt.receipt_type as string}</DetailRow>
        <DetailRow label="Agent">
          <Link href={`/agents/${receipt.agent_id}`} className="text-primary hover:underline">
            {receipt.agent_id as string}
          </Link>
        </DetailRow>
        <DetailRow label="Org">{receipt.org_id as string}</DetailRow>
        <DetailRow label="Environment">{receipt.environment as string}</DetailRow>
      </Section>

      {/* Timestamps */}
      <Section title="Timestamps">
        <DetailRow label="Created">
          <span className="inline-flex items-center gap-2">
            {formatDate(receipt.timestamp as string)}
            <TimeAgo date={receipt.timestamp as string} className="text-xs" />
          </span>
        </DetailRow>
        <DetailRow label="Completed">
          {receipt.completed_at ? formatDate(receipt.completed_at as string) : '—'}
        </DetailRow>
        <DetailRow label="Duration">{formatDuration(receipt.latency_ms as number | null)}</DetailRow>
        {expiresAt && (
          <DetailRow label="Expires">
            <span className={cn(new Date(expiresAt) < new Date() && 'text-danger')}>
              {formatDate(expiresAt)}
              {' '}
              {new Date(expiresAt) < new Date() ? '(Expired)' : <TimeAgo date={expiresAt} className="text-xs" />}
            </span>
          </DetailRow>
        )}
      </Section>

      {/* Action */}
      <Section title="Action">
        <DetailRow label="Action">{receipt.action as string}</DetailRow>
        <DetailRow label="Input Hash" mono>
          {receipt.input_hash ? <HashDisplay hash={receipt.input_hash as string} length={32} /> : '—'}
        </DetailRow>
        <DetailRow label="Output Hash" mono>
          {receipt.output_hash ? <HashDisplay hash={receipt.output_hash as string} length={32} /> : '—'}
        </DetailRow>
        {typeof receipt.output_summary === 'string' && receipt.output_summary && (
          <DetailRow label="Output Summary">{receipt.output_summary}</DetailRow>
        )}
      </Section>

      {/* Performance */}
      <Section title="Performance">
        <DetailRow label="Latency">
          {receipt.latency_ms !== null ? (
            <div className="flex items-center gap-2">
              <span>{formatDuration(receipt.latency_ms as number)}</span>
              <div className="flex-1 max-w-32 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    (receipt.latency_ms as number) < 1000 ? 'bg-success' :
                    (receipt.latency_ms as number) < 5000 ? 'bg-warning' : 'bg-danger'
                  )}
                  style={{ width: `${Math.min(100, ((receipt.latency_ms as number) / 10000) * 100)}%` }}
                />
              </div>
            </div>
          ) : '—'}
        </DetailRow>
        <DetailRow label="Cost">{formatCurrency(receipt.cost_usd as number | null)}</DetailRow>
        <DetailRow label="Tokens">
          {receipt.tokens_in !== null || receipt.tokens_out !== null
            ? `${formatNumber(receipt.tokens_in as number ?? 0)} in / ${formatNumber(receipt.tokens_out as number ?? 0)} out`
            : '—'}
        </DetailRow>
        <DetailRow label="Model">{(receipt.model as string) ?? '—'}</DetailRow>
        <DetailRow label="Confidence">
          {receipt.confidence !== null ? (
            <div className="flex items-center gap-2">
              <span>{((receipt.confidence as number) * 100).toFixed(0)}%</span>
              <div className="flex-1 max-w-32 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(receipt.confidence as number) * 100}%` }}
                />
              </div>
            </div>
          ) : '—'}
        </DetailRow>
        {Array.isArray(receipt.tool_calls) && (receipt.tool_calls as string[]).length > 0 && (
          <DetailRow label="Tool Calls">
            <div className="flex flex-wrap gap-1">
              {(receipt.tool_calls as string[]).map(tc => (
                <code key={tc} className="px-1.5 py-0.5 text-xs bg-bg-tertiary rounded">{tc}</code>
              ))}
            </div>
          </DetailRow>
        )}
      </Section>

      {/* Constraints */}
      {cr && Array.isArray(cr.results) && cr.results.length > 0 && (
        <Section
          title="Constraints"
          badge={<ConstraintBadge passed={cr.results.filter(x => x.passed).length} total={cr.results.length} />}
        >
          <div className="divide-y divide-border-subtle">
            {cr.results.map((c, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                {c.passed ? (
                  <Check className="w-4 h-4 text-success shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-danger shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-medium">{c.type}</code>
                    {!c.passed && <span className="text-xs text-danger font-medium">FAILED</span>}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    expected: {JSON.stringify(c.expected)} — actual: {JSON.stringify(c.actual)}
                    {c.message && <span className="ml-2">({c.message})</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Judgments */}
      {data.judgments && data.judgments.length > 0 && (
        <Section title="Judgments" badge={<span className="text-xs text-text-muted">{data.judgments.length} judgment{data.judgments.length > 1 ? 's' : ''}</span>}>
          <div className="space-y-3 py-2">
            {data.judgments.map(j => {
              const jReceipt = j as Record<string, unknown>
              const jMeta = jReceipt.metadata as Record<string, unknown> | null
              const verdict = jMeta?.verdict as string | undefined
              const score = jMeta?.score as number | undefined
              const reasoning = jMeta?.reasoning as string | undefined
              const criteria = jMeta?.criteria as { criterion: string; score: number; reasoning: string }[] | undefined
              const verdictColors = VERDICT_COLORS[verdict ?? ''] ?? { bg: 'bg-bg-tertiary', text: 'text-text-secondary' }

              return (
                <div key={jReceipt.receipt_id as string} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Link href={`/receipts/${jReceipt.receipt_id}`} className="font-mono text-xs text-primary hover:underline">
                      {truncateId(jReceipt.receipt_id as string)}
                    </Link>
                    <div className="flex items-center gap-2">
                      {verdict && (
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium uppercase', verdictColors.bg, verdictColors.text)}>
                          {verdict} {score !== undefined && `(${score.toFixed(2)})`}
                        </span>
                      )}
                    </div>
                  </div>

                  {Array.isArray(criteria) && criteria.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {criteria.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {c.score >= 0.7 ? <Check className="w-3 h-3 text-success" /> : <X className="w-3 h-3 text-danger" />}
                          <span className="font-medium w-24">{c.criterion}</span>
                          <span className="text-text-muted">{c.score.toFixed(2)}</span>
                          <span className="text-text-muted truncate">{c.reasoning}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {reasoning && (
                    <p className="text-xs text-text-secondary">{reasoning}</p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                    <span>Judge: {jReceipt.model as string ?? 'unknown'}</span>
                    <TimeAgo date={jReceipt.timestamp as string} />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Memory Operation */}
      <MemorySection metadata={metadata} />

      {/* Chain */}
      {data.chain && data.chain.length > 1 && (
        <Section title="Chain" badge={<span className="text-xs text-text-muted">{data.chain.length} receipts</span>}>
          <div className="py-2 space-y-1">
            {data.chain.map(c => {
              const chainReceipt = c as Record<string, unknown>
              const isCurrent = chainReceipt.receipt_id === receipt.receipt_id
              return (
                <div key={chainReceipt.receipt_id as string} className={cn('flex items-center gap-3 py-1.5 px-2 rounded', isCurrent && 'bg-primary-subtle')}>
                  <div className={cn('w-2 h-2 rounded-full shrink-0', isCurrent ? 'bg-primary' : 'bg-text-muted')} />
                  <Link
                    href={`/receipts/${chainReceipt.receipt_id}`}
                    className={cn('font-mono text-xs', isCurrent ? 'text-primary font-medium' : 'text-text-secondary hover:text-primary')}
                  >
                    {truncateId(chainReceipt.receipt_id as string)}
                  </Link>
                  <span className="text-xs text-text-secondary">{chainReceipt.action as string}</span>
                  <StatusBadge status={chainReceipt.status as string} />
                  {isCurrent && <span className="text-xs text-primary font-medium ml-auto">current</span>}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Cryptographic Proof */}
      <Section title="Cryptographic Proof">
        <DetailRow label="Signature" mono>
          <HashDisplay hash={receipt.signature as string} length={32} />
        </DetailRow>
        <DetailRow label="Status">
          {isDemoMode ? (
            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Info className="w-4 h-4" />
              Demo signature (placeholder)
            </span>
          ) : (
            <span className={cn('inline-flex items-center gap-1', data.verified ? 'text-success' : 'text-danger')}>
              {data.verified ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
              {data.verified ? 'Signature verified' : 'Signature invalid or unverifiable'}
            </span>
          )}
        </DetailRow>
        {isDemoMode && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Demo mode:</strong> Signatures in this demo are placeholders. In production, every receipt is signed with Ed25519 cryptography using your private key. Anyone with your public key can verify authenticity — no central authority required.{' '}
              <a href="/how-it-works#cryptographic-proof" className="underline font-medium">Learn how it works &rarr;</a>
            </p>
          </div>
        )}
      </Section>

      {/* Raw JSON */}
      <JsonViewer data={receipt} label="View Raw JSON" />
    </div>
  )
}
