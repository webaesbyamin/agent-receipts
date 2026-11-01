'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingTable } from '@/components/shared/loading'
import { TimeAgo } from '@/components/shared/time-ago'
import { formatDuration } from '@/lib/formatters'
import { cn } from '@/lib/cn'
import { TerminalSquare, Plug } from 'lucide-react'
import type { SessionSummary } from '@/lib/sessions'

async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch('/api/sessions')
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
  return body.sessions
}

function ToolChips({ tools }: { tools: Record<string, number> }) {
  const entries = Object.entries(tools).sort((a, b) => b[1] - a[1])
  return (
    <div className="flex flex-wrap gap-1">
      {entries.slice(0, 4).map(([tool, n]) => (
        <span key={tool} className="px-1.5 py-0.5 text-[11px] font-mono rounded bg-bg-secondary border border-border text-text-secondary">
          {tool}{n > 1 ? ` ×${n}` : ''}
        </span>
      ))}
      {entries.length > 4 && <span className="text-[11px] text-text-muted">+{entries.length - 4}</span>}
    </div>
  )
}

export default function SessionsPage() {
  const { data, error, mutate } = useSWR('sessions', fetchSessions, { refreshInterval: 10_000 })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Sessions</h1>
        <p className="text-sm text-text-muted">
          Claude Code sessions and MCP proxy sessions, each one chain of signed receipts.
        </p>
      </div>

      {error ? <ErrorState message={error.message} onRetry={() => mutate()} /> : !data ? <LoadingTable /> : data.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={TerminalSquare}
            title="No sessions yet"
            description="Turn on automatic receipts and every Claude Code action, or every tool call to an MCP server, is signed and shows up here."
            action={
              <div className="text-left space-y-2">
                <code className="block font-mono text-xs bg-bg-secondary border border-border rounded px-3 py-2 text-text-secondary">npx @agent-receipts/cli hooks install</code>
                <code className="block font-mono text-xs bg-bg-secondary border border-border rounded px-3 py-2 text-text-secondary">agent-receipts proxy --name &lt;server&gt; -- &lt;command&gt;</code>
              </div>
            }
          />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3 text-right">Actions</th>
                <th className="px-4 py-3">Tools</th>
                <th className="px-4 py-3 text-right">Files</th>
                <th className="px-4 py-3 text-right">Failures</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => {
                const Icon = s.kind === 'mcp' ? Plug : TerminalSquare
                return (
                  <tr key={s.chain_id} className="border-b border-border last:border-0 hover:bg-bg-secondary transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/sessions/${encodeURIComponent(s.chain_id)}`} className="flex items-center gap-2 min-w-0">
                        <Icon className="w-4 h-4 text-text-muted shrink-0" />
                        <span className="font-medium text-text-primary whitespace-nowrap">{s.label}</span>
                        <code className="font-mono text-xs text-primary truncate max-w-[14rem]">{s.chain_id}</code>
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-text-secondary"><TimeAgo date={s.started} /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-text-secondary">{formatDuration(s.duration_ms)}</td>
                    <td className="px-4 py-3 text-right text-text-primary">{s.actions}</td>
                    <td className="px-4 py-3"><ToolChips tools={s.tools} /></td>
                    <td className="px-4 py-3 text-right text-text-secondary">{s.files_touched}</td>
                    <td className={cn('px-4 py-3 text-right', s.failed > 0 ? 'text-danger font-medium' : 'text-text-muted')}>{s.failed}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
