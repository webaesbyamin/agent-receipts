import type { ActionReceipt } from '@agent-receipts/schema'
import type { AppStore } from './storage'

/** Receipts written by the Claude Code hooks and by the MCP proxy (agent-receipts hooks / proxy). */
export const CLAUDE_CODE_AGENT = 'claude-code'
export const MCP_PROXY_AGENT = 'mcp-proxy'
const SESSION_END = 'claude_code.session_end'

export type SessionKind = 'claude-code' | 'mcp'

export interface SessionFile { name: string; sha256: string; bytes: number }

export interface SessionSummary {
  chain_id: string
  kind: SessionKind
  /** "Claude Code", or the MCP server's name */
  label: string
  started: string
  ended: string
  duration_ms: number
  actions: number
  failed: number
  tools: Record<string, number>
  files_touched: number
  /** Claude Code sessions: whether the SessionEnd summary receipt is there */
  ended_cleanly: boolean
}

export interface SessionAction {
  receipt_id: string
  tool: string
  status: string
  timestamp: string
  latency_ms: number | null
  files: SessionFile[]
  /** proxy: is_error, error, cancelled, no_response */
  failure: string | null
}

export interface SessionDetail extends SessionSummary {
  actions_list: SessionAction[]
  /** Every file touched, with its hash after the last change */
  files: Array<SessionFile & { changes: number }>
  client: string | null
  server: string | null
}

const meta = (r: ActionReceipt) => (r.metadata ?? {}) as Record<string, Record<string, unknown> | undefined>
const toolOf = (r: ActionReceipt) => r.action.replace(/^claude_code\./, '').replace(/^mcp\.[^.]+\./, '')

function summarize(chainId: string, receipts: ActionReceipt[]): SessionSummary {
  const kind: SessionKind = receipts[0]!.agent_id === MCP_PROXY_AGENT ? 'mcp' : 'claude-code'
  const actions = receipts.filter((r) => r.action !== SESSION_END)
  const tools: Record<string, number> = {}
  const files = new Set<string>()
  for (const r of actions) {
    tools[toolOf(r)] = (tools[toolOf(r)] ?? 0) + 1
    for (const f of r.files ?? []) files.add(f.name)
  }
  const starts = receipts.map((r) => new Date(r.timestamp).getTime())
  const ends = receipts.map((r) => new Date(r.completed_at ?? r.timestamp).getTime())
  const started = Math.min(...starts)
  const ended = Math.max(...ends)
  const server = kind === 'mcp' ? (meta(receipts[0]!)['mcp']?.['server'] as string | undefined) : undefined
  return {
    chain_id: chainId,
    kind,
    label: kind === 'mcp' ? `MCP · ${server ?? 'server'}` : 'Claude Code',
    started: new Date(started).toISOString(),
    ended: new Date(ended).toISOString(),
    duration_ms: Math.max(0, ended - started),
    actions: actions.length,
    failed: actions.filter((r) => r.status === 'failed' || r.status === 'timeout').length,
    tools,
    files_touched: files.size,
    ended_cleanly: receipts.some((r) => r.action === SESSION_END),
  }
}

async function sessionReceipts(store: AppStore): Promise<Map<string, ActionReceipt[]>> {
  const byChain = new Map<string, ActionReceipt[]>()
  for (const agent of [CLAUDE_CODE_AGENT, MCP_PROXY_AGENT]) {
    const { data } = await store.list({ agent_id: agent }, 1, 100_000, 'timestamp:asc')
    for (const r of data) {
      if (!byChain.has(r.chain_id)) byChain.set(r.chain_id, [])
      byChain.get(r.chain_id)!.push(r)
    }
  }
  return byChain
}

export async function listSessions(store: AppStore): Promise<SessionSummary[]> {
  const byChain = await sessionReceipts(store)
  return [...byChain].map(([id, rs]) => summarize(id, rs)).sort((a, b) => b.started.localeCompare(a.started))
}

export async function getSession(store: AppStore, chainId: string): Promise<SessionDetail | null> {
  const receipts = (await store.getChain(chainId)).filter((r) => r.agent_id === CLAUDE_CODE_AGENT || r.agent_id === MCP_PROXY_AGENT)
  if (receipts.length === 0) return null
  const summary = summarize(chainId, receipts)
  const actions = receipts.filter((r) => r.action !== SESSION_END)
  const files = new Map<string, SessionFile & { changes: number; at: string }>()
  for (const r of actions) {
    for (const f of r.files ?? []) {
      const prev = files.get(f.name)
      if (!prev || r.timestamp >= prev.at) files.set(f.name, { name: f.name, sha256: f.sha256, bytes: f.bytes, changes: (prev?.changes ?? 0) + 1, at: r.timestamp })
      else prev.changes++
    }
  }
  const mcp = meta(receipts[0]!)['mcp']
  const info = (v: unknown) => {
    const o = v as { name?: string; version?: string } | undefined
    return o?.name ? `${o.name}${o.version ? ` ${o.version}` : ''}` : null
  }
  return {
    ...summary,
    actions_list: actions.map((r) => ({
      receipt_id: r.receipt_id,
      tool: toolOf(r),
      status: r.status,
      timestamp: r.timestamp,
      latency_ms: r.latency_ms ?? null,
      files: (r.files ?? []).map((f) => ({ name: f.name, sha256: f.sha256, bytes: f.bytes })),
      failure: (meta(r)['mcp']?.['failure'] as string | undefined) ?? (r.status === 'failed' ? 'failed' : null),
    })),
    files: [...files.values()].map(({ at: _at, ...f }) => f).sort((a, b) => a.name.localeCompare(b.name)),
    client: info(mcp?.['client_info']),
    server: info(mcp?.['server_info']),
  }
}
