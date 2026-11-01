/**
 * Claude Code hooks: one signed receipt per tool call, and a session summary.
 *
 * Runs inside the hook process Claude Code starts for each event (as an async
 * hook, so Claude Code doesn't wait for it). Every receipt is signed here and
 * now, never queued unsigned for later: the agent could edit a queue file.
 *
 * Privacy: receipts carry hashes, never raw commands, file contents or tool
 * output. With --store-commands, Bash/PowerShell receipts also carry a short,
 * redacted label such as "git commit".
 */
import { createHash } from 'node:crypto'
import { readFileSync, appendFileSync, mkdirSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'node:fs'
import { join, relative, isAbsolute, sep } from 'node:path'
import { SqliteReceiptStore, KeyManager, ConfigManager, ReceiptEngine, hashData, isSupportedNode, unsupportedNodeMessage } from '@agent-receipts/mcp-server'
import type { FileManifestEntry, ActionReceipt } from '@agent-receipts/schema'

export const AGENT_ID = 'claude-code'
export const SESSION_END_ACTION = 'claude_code.session_end'
const MAX_FILES = 200
/** How long the session summary waits for this session's in-flight tool hooks (settings hooks get 10 s in all). */
export const INFLIGHT_WAIT_MS = 3000
/** An in-flight marker older than this belongs to a hook that died; ignore it. */
const INFLIGHT_STALE_MS = 30_000

/** The fields of Claude Code's hook input that receipts use (see the hooks reference). */
export interface HookInput {
  session_id: string
  cwd?: string
  hook_event_name: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  tool_response?: unknown
  tool_use_id?: string
  error?: string
  is_interrupt?: boolean
  duration_ms?: number
  permission_mode?: string
  agent_id?: string
  agent_type?: string
  reason?: string
}

export interface HookOptions {
  dataDir: string
  storeCommands: boolean
  /** Session summary only: how long to wait for tool hooks still signing. */
  inflightWaitMs?: number
  /** For tests: the clock. */
  now?: () => Date
}

export function parseHookArgs(argv: string[]): { mode: string; storeCommands: boolean; dataDir: string; inflightWaitMs: number } {
  const value = (flag: string) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined }
  const wait = Number(value('--inflight-wait-ms'))
  return {
    mode: argv[0] ?? '',
    storeCommands: argv.includes('--store-commands'),
    dataDir: value('--data-dir') || ConfigManager.getDefaultDataDir(),
    inflightWaitMs: Number.isFinite(wait) && wait >= 0 ? wait : INFLIGHT_WAIT_MS,
  }
}

/** Path relative to the session's working directory, with forward slashes. */
export function relativeName(path: string, cwd: string | undefined): string {
  const rel = cwd && isAbsolute(path) ? relative(cwd, path) : path
  return (rel || '.').split(sep).join('/')
}

/** The files a tool call changed, by absolute path (Bash: Claude Code's best-effort change list). */
export function changedPaths(input: HookInput): string[] {
  const ti = input.tool_input ?? {}
  switch (input.tool_name) {
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
      return typeof ti['file_path'] === 'string' ? [ti['file_path']] : []
    case 'NotebookEdit': {
      const p = ti['notebook_path'] ?? ti['file_path']
      return typeof p === 'string' ? [p] : []
    }
    case 'Bash':
    case 'PowerShell': {
      const diff = (input.tool_response as { bashEditDiff?: { changedFiles?: unknown } } | undefined)?.bashEditDiff
      const files = Array.isArray(diff?.changedFiles) ? diff!.changedFiles : []
      return files.filter((f): f is string => typeof f === 'string')
    }
    default:
      return []
  }
}

/** SHA-256 of each file as it is now, after the tool ran. Files that no longer exist are listed separately. */
export function hashFiles(paths: string[], cwd: string | undefined): { files: FileManifestEntry[]; missing: string[] } {
  const files: FileManifestEntry[] = []
  const missing: string[] = []
  for (const path of [...new Set(paths)].slice(0, MAX_FILES)) {
    const name = relativeName(path, cwd)
    try {
      const data = readFileSync(path)
      files.push({ name, sha256: `sha256:${createHash('sha256').update(data).digest('hex')}`, bytes: data.length, role: 'output' })
    } catch {
      missing.push(name)
    }
  }
  return { files, missing }
}

const SUBCOMMAND = /^[a-z][a-z0-9:_-]{0,23}$/
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
const WRAPPERS = new Set(['sudo', 'env', 'time', 'nohup', 'exec', 'command'])

/**
 * A short label for a shell command that keeps no secrets: the program's
 * name and, if it looks like one, its subcommand ("git commit", "npm test").
 * Everything else (arguments, paths, URLs, quoted text, variables, the rest
 * of a pipeline) is dropped, and a trailing "…" says something was.
 */
export function commandLabel(command: string): string {
  const first = command.trim().split(/\r?\n/)[0] ?? ''
  const simple = first.split(/&&|\|\||[;|&]/)[0] ?? ''
  const tokens = simple.trim().split(/\s+/).filter(Boolean)
  let i = 0
  while (i < tokens.length && (ASSIGNMENT.test(tokens[i]!) || WRAPPERS.has(tokens[i]!))) {
    i++
    // A wrapper's own flags (sudo -E, env -i) are not the program
    while (WRAPPERS.has(tokens[i - 1]!) && tokens[i]?.startsWith('-')) i++
  }
  const prog = tokens[i]
  if (!prog || /["'`$\\]/.test(prog)) return '…'
  const name = prog.split(/[\\/]/).pop()!.slice(0, 32)
  const sub = tokens[i + 1]
  const parts = [name]
  if (sub && SUBCOMMAND.test(sub)) parts.push(sub)
  const dropped = tokens.length > i + parts.length || simple.length < first.length || first.length < command.trim().length
  return parts.join(' ') + (dropped ? ' …' : '')
}

function log(dataDir: string, message: string): void {
  try {
    mkdirSync(dataDir, { recursive: true })
    appendFileSync(join(dataDir, 'hooks.log'), `${new Date().toISOString()} ${message}\n`)
  } catch {
    // Nowhere left to report to; stay silent
  }
}

async function openEngine(dataDir: string) {
  // Receipts from this hook are always signed as the claude-code agent
  process.env['AGENT_RECEIPTS_AGENT_ID'] = AGENT_ID
  const store = new SqliteReceiptStore(dataDir)
  await store.init()
  const keys = new KeyManager(dataDir)
  await keys.init()
  const config = new ConfigManager(dataDir)
  await config.init()
  return { store, engine: new ReceiptEngine(store, keys, config) }
}

const inflightDir = (dataDir: string) => join(dataDir, 'hooks', 'inflight')
const sessionTag = (sessionId: string) => createHash('sha256').update(sessionId).digest('hex').slice(0, 16)

/** One signed receipt for one tool call (PostToolUse or PostToolUseFailure). */
export async function recordToolCall(input: HookInput, opts: HookOptions): Promise<ActionReceipt> {
  const now = (opts.now ?? (() => new Date()))()
  const failed = input.hook_event_name === 'PostToolUseFailure'
  const tool = input.tool_name ?? 'unknown'
  const { files, missing } = hashFiles(changedPaths(input), input.cwd)

  const claudeCode: Record<string, unknown> = { event: input.hook_event_name, tool_use_id: input.tool_use_id ?? null }
  if (input.agent_type) claudeCode['subagent'] = input.agent_type
  if (input.is_interrupt) claudeCode['interrupted'] = true
  if (missing.length) claudeCode['files_missing'] = missing
  if (opts.storeCommands && (tool === 'Bash' || tool === 'PowerShell') && typeof input.tool_input?.['command'] === 'string') {
    const command = input.tool_input['command']
    claudeCode['command_hash'] = hashData(command)
    claudeCode['command_label'] = commandLabel(command)
  }

  const { store, engine } = await openEngine(opts.dataDir)
  try {
    return await engine.create({
      action: `claude_code.${tool}`,
      chain_id: input.session_id,
      status: failed ? 'failed' : 'completed',
      input_hash: hashData(input.tool_input ?? null),
      output_hash: hashData(failed ? (input.error ?? null) : (input.tool_response ?? null)),
      latency_ms: typeof input.duration_ms === 'number' ? Math.round(input.duration_ms) : null,
      started_at: typeof input.duration_ms === 'number' ? new Date(now.getTime() - input.duration_ms).toISOString() : now.toISOString(),
      tool_calls: [tool],
      tags: ['claude-code'],
      files,
      metadata: { claude_code: claudeCode },
    })
  } finally {
    store.close()
  }
}

/** Wait (briefly) for this session's tool hooks that are still signing, so the summary counts them. */
async function waitForInflight(dataDir: string, sessionId: string, deadline: number): Promise<void> {
  const tag = sessionTag(sessionId)
  while (Date.now() < deadline) {
    let busy = false
    try {
      for (const f of readdirSync(inflightDir(dataDir))) {
        if (!f.startsWith(tag)) continue
        const age = Date.now() - statSync(join(inflightDir(dataDir), f)).mtimeMs
        if (age < INFLIGHT_STALE_MS) busy = true
      }
    } catch {
      return
    }
    if (!busy) return
    await new Promise((r) => setTimeout(r, 25))
  }
}

/** The session summary receipt (SessionEnd), linked into the session's chain. */
export async function recordSessionEnd(input: HookInput, opts: HookOptions): Promise<ActionReceipt> {
  const now = (opts.now ?? (() => new Date()))()
  await waitForInflight(opts.dataDir, input.session_id, Date.now() + (opts.inflightWaitMs ?? INFLIGHT_WAIT_MS))
  const { store, engine } = await openEngine(opts.dataDir)
  try {
    const chain = (await store.getChain(input.session_id)).filter((r) => r.agent_id === AGENT_ID && r.action !== SESSION_END_ACTION)
    const byTool: Record<string, number> = {}
    const files = new Set<string>()
    let failed = 0
    for (const r of chain) {
      const tool = r.action.replace(/^claude_code\./, '')
      byTool[tool] = (byTool[tool] ?? 0) + 1
      if (r.status === 'failed') failed++
      for (const f of r.files ?? []) files.add(f.name)
    }
    const first = chain.reduce<string | null>((min, r) => (!min || r.timestamp < min ? r.timestamp : min), null)
    const summary = {
      actions: chain.length,
      failed,
      by_tool: byTool,
      files_touched: files.size,
      files: [...files].sort().slice(0, MAX_FILES),
      // From the first recorded action to the end of the session
      duration_ms: first ? Math.max(0, now.getTime() - new Date(first).getTime()) : 0,
      reason: input.reason ?? null,
    }
    return await engine.create({
      action: SESSION_END_ACTION,
      chain_id: input.session_id,
      status: 'completed',
      input_hash: hashData({ session_id: input.session_id, reason: input.reason ?? null }),
      output_hash: hashData(summary),
      // The summary is the session's last entry; its duration says when the session's work began
      started_at: now.toISOString(),
      tags: ['claude-code', 'session-summary'],
      metadata: { claude_code: { event: 'SessionEnd', summary } },
    })
  } finally {
    store.close()
  }
}

/**
 * The hook's whole job, for one event. Never throws: any problem goes to
 * <data dir>/hooks.log and the hook exits 0, so Claude Code is never blocked.
 */
export async function runHook(argv: string[], stdin: string, now?: () => Date): Promise<void> {
  const { mode, storeCommands, dataDir, inflightWaitMs } = parseHookArgs(argv)
  let marker: string | null = null
  try {
    if (!isSupportedNode()) throw new Error(unsupportedNodeMessage())
    let input: HookInput
    try {
      input = JSON.parse(stdin) as HookInput
    } catch {
      // V8's parse errors quote the input, which may hold commands or file contents
      throw new Error('hook input is not valid JSON')
    }
    if (!input || typeof input.session_id !== 'string' || !input.session_id) throw new Error('hook input has no session_id')
    const opts = { dataDir, storeCommands, inflightWaitMs, now }
    if (mode === 'post-tool-use') {
      try {
        mkdirSync(inflightDir(dataDir), { recursive: true })
        marker = join(inflightDir(dataDir), `${sessionTag(input.session_id)}.${process.pid}.${Date.now()}`)
        writeFileSync(marker, '')
      } catch {
        marker = null
      }
      await recordToolCall(input, opts)
    } else if (mode === 'session-end') {
      await recordSessionEnd(input, opts)
    } else {
      throw new Error(`unknown hook mode "${mode}"`)
    }
  } catch (err) {
    // The message only: never the hook input, which holds commands and file contents
    log(dataDir, `${mode || 'hook'}: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    if (marker) try { unlinkSync(marker) } catch { /* already gone */ }
  }
}
