'use client'

import { use, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { StatCard } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingPage } from '@/components/shared/loading'
import { CopyButton } from '@/components/shared/copy-button'
import { HashDisplay } from '@/components/shared/hash-display'
import { formatDuration, formatDate, truncateId } from '@/lib/formatters'
import { cn } from '@/lib/cn'
import { ArrowLeft, Clock, Activity, FileText, AlertTriangle, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'
import type { SessionDetail } from '@/lib/sessions'

interface Verification {
  valid: boolean
  problems: string[]
  receipts: Array<{ receipt_id: string; signature_valid: boolean; link_valid: boolean | null }>
  public_key: string
  checked_at: string
}

async function fetchSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body
}

function VerifyPanel({ id, count }: { id: string; count: number }) {
  const [state, setState] = useState<{ busy: boolean; result?: Verification; error?: string }>({ busy: false })
  async function verify() {
    setState({ busy: true })
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/verify`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      setState({ busy: false, result: body })
    } catch (err) {
      setState({ busy: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
  const r = state.result
  return (
    <div className={cn('card p-4', r && (r.valid ? 'border-success' : 'border-danger'))}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={verify}
          disabled={state.busy}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          {state.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Verify this session
        </button>
        {!r && !state.error && (
          <span className="text-sm text-text-muted">Checks all {count} signatures with this computer&apos;s public key, and every link to the receipt before it.</span>
        )}
        {r && (
          <span role="status" className={cn('inline-flex items-center gap-2 text-sm font-medium', r.valid ? 'text-success' : 'text-danger')}>
            {r.valid ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
            {r.valid
              ? `Verified: all ${r.receipts.length} receipts are signed and linked, unchanged since signing.`
              : `Not verified: ${r.problems.length} problem${r.problems.length === 1 ? '' : 's'}.`}
          </span>
        )}
        {state.error && <span role="status" className="text-sm text-danger">{state.error}</span>}
      </div>
      {r && !r.valid && (
        <ul className="mt-3 space-y-1 text-xs font-mono text-danger list-disc pl-5">
          {r.problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
      {r && (
        <p className="mt-3 text-xs text-text-muted">
          Public key <code className="font-mono">{truncateId(r.public_key)}</code> · checked {formatDate(r.checked_at)}. Same check as <code className="font-mono">agent-receipts verify-chain {truncateId(id)}</code>.
        </p>
      )}
    </div>
  )
}

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = use(params)
  const id = decodeURIComponent(raw)
  const { data, error, mutate } = useSWR<SessionDetail>(`session-${id}`, () => fetchSession(id))

  if (error) return <ErrorState message={error.message} onRetry={() => mutate()} />
  if (!data) return <LoadingPage />

  return (
    <div className="space-y-4 max-w-5xl">
      <Link href="/sessions" className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary">
        <ArrowLeft className="w-4 h-4" /> Back to Sessions
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-text-primary">{data.label}</h1>
          <code className="font-mono text-sm text-primary break-all">{data.chain_id}</code>
          <CopyButton value={data.chain_id} />
        </div>
        <p className="text-sm text-text-muted mt-1">
          {formatDate(data.started)}
          {data.kind === 'claude-code' && !data.ended_cleanly && ' · no session-end summary (still running, or ended without SessionEnd)'}
          {data.client && ` · client ${data.client}`}
          {data.server && ` · server ${data.server}`}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Duration" value={formatDuration(data.duration_ms)} icon={Clock} />
        <StatCard label="Actions" value={data.actions} icon={Activity} />
        <StatCard label="Files touched" value={data.files_touched} icon={FileText} />
        <StatCard label="Failures" value={data.failed} icon={AlertTriangle} className={data.failed > 0 ? 'border-danger' : undefined} />
      </div>

      <VerifyPanel id={data.chain_id} count={data.actions_list.length + (data.ended_cleanly ? 1 : 0)} />

      <div className="card">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">Tools used</h3>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {Object.entries(data.tools).sort((a, b) => b[1] - a[1]).map(([tool, n]) => (
            <span key={tool} className="px-2 py-1 text-xs font-mono rounded-md bg-bg-secondary border border-border text-text-secondary">
              {tool} <span className="text-text-muted">×{n}</span>
            </span>
          ))}
        </div>
      </div>

      {data.files.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text-primary">Files touched</h3>
            <p className="text-xs text-text-muted">Paths and SHA-256 after the last change. Receipts never hold file contents.</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {data.files.map((f) => (
                <tr key={f.name} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-text-primary break-all">{f.name}</td>
                  <td className="px-4 py-2"><HashDisplay hash={f.sha256.replace(/^sha256:/, '')} length={16} /></td>
                  <td className="px-4 py-2 text-xs text-text-muted whitespace-nowrap text-right">{f.bytes.toLocaleString()} bytes</td>
                  <td className="px-4 py-2 text-xs text-text-muted whitespace-nowrap text-right">{f.changes} change{f.changes === 1 ? '' : 's'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-text-primary">Actions</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-text-muted uppercase tracking-wider">
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Tool</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Files</th>
              <th className="px-4 py-2 text-right">Took</th>
              <th className="px-4 py-2">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {data.actions_list.map((a) => (
              <tr key={a.receipt_id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-xs text-text-muted whitespace-nowrap">{new Date(a.timestamp).toLocaleTimeString()}</td>
                <td className="px-4 py-2 font-mono text-xs text-text-primary">{a.tool}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <StatusBadge status={a.status} />
                  {a.failure && a.failure !== 'failed' && <span className="ml-2 text-xs text-text-muted">{a.failure.replace('_', ' ')}</span>}
                </td>
                <td className="px-4 py-2 font-mono text-xs text-text-secondary">{a.files.map((f) => f.name).join(', ') || <span className="text-text-muted">none</span>}</td>
                <td className="px-4 py-2 text-xs text-text-muted text-right whitespace-nowrap">{formatDuration(a.latency_ms)}</td>
                <td className="px-4 py-2">
                  <Link href={`/receipts/${a.receipt_id}`} className="font-mono text-xs text-primary hover:underline">{truncateId(a.receipt_id)}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
