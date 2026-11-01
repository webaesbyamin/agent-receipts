/**
 * agent-receipts proxy [--name <server-name>] -- <command> [args...]
 *
 * A stdio passthrough in front of any MCP server. Every byte goes through
 * unchanged, both ways. Beside the stream, a passive reader watches the
 * newline-delimited JSON-RPC messages and, for each tools/call, signs one v2
 * receipt once the response has already been forwarded. Hashes only: never
 * the arguments or the result.
 *
 * stdio servers only. Remote (HTTP) MCP servers aren't covered in 0.6.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Readable, Writable } from 'node:stream'
import type { ChildProcess } from 'node:child_process'
import crossSpawn from 'cross-spawn'
import { SqliteReceiptStore, KeyManager, ConfigManager, ReceiptEngine, hashData } from '@agent-receipts/mcp-server'

export const PROXY_AGENT_ID = 'mcp-proxy'
/** Messages bigger than this are still forwarded, just not observed (no receipt). */
const MAX_OBSERVED_LINE = 64 * 1024 * 1024
/** At exit, how long to wait for receipts still being signed. */
const DRAIN_MS = 5000

type Json = Record<string, unknown>

/**
 * Splits a byte stream into lines without decoding until a line is complete,
 * so a multi-byte character split across chunks is never mangled.
 */
export class LineReader {
  private parts: Buffer[] = []
  private size = 0
  private skipping = false
  constructor(private onLine: (line: string) => void) {}

  push(chunk: Buffer): void {
    let start = 0
    for (let nl = chunk.indexOf(10, start); nl !== -1; nl = chunk.indexOf(10, start)) {
      this.add(chunk.subarray(start, nl))
      if (!this.skipping) this.onLine(Buffer.concat(this.parts, this.size).toString('utf8'))
      this.parts = []
      this.size = 0
      this.skipping = false
      start = nl + 1
    }
    if (start < chunk.length) this.add(chunk.subarray(start))
  }

  private add(b: Buffer): void {
    if (this.skipping) return
    if (this.size + b.length > MAX_OBSERVED_LINE) { this.skipping = true; this.parts = []; this.size = 0; return }
    this.parts.push(Buffer.from(b))
    this.size += b.length
  }
}

/** JSON-RPC messages in one line: an object, or a (legacy) batch array. Anything else: none. */
export function messagesIn(line: string): Json[] {
  const text = line.trim()
  if (!text) return []
  try {
    const v = JSON.parse(text) as unknown
    if (Array.isArray(v)) return v.filter((m): m is Json => !!m && typeof m === 'object')
    return v && typeof v === 'object' ? [v as Json] : []
  } catch {
    return []
  }
}

const idKey = (id: unknown) => JSON.stringify(id)
const META_CLIENT = 'io.modelcontextprotocol/clientInfo'
const META_SERVER = 'io.modelcontextprotocol/serverInfo'

export interface PendingCall { tool: string; inputHash: string; startedAt: number }

export interface CallRecord {
  tool: string
  inputHash: string
  outputHash: string | null
  status: 'completed' | 'failed'
  latencyMs: number
  startedAt: number
  /** 'error' (JSON-RPC error), 'is_error' (result.isError), 'cancelled', 'no_response' */
  reason?: 'error' | 'is_error' | 'cancelled' | 'no_response'
}

/**
 * Pairs tools/call requests (client → server) with their responses (server →
 * client) by id. The server's own requests to the client (sampling, roots,
 * elicitation) and the client's answers to them are ignored.
 */
export class CallTracker {
  readonly pending = new Map<string, PendingCall>()
  clientInfo: Json | null = null
  serverInfo: Json | null = null
  constructor(private onRecord: (r: CallRecord) => void, private now = () => Date.now()) {}

  fromClient(msg: Json): void {
    // Who's calling: `initialize` params, or (newer protocol revisions, e.g. server/discover) request _meta
    const params = msg['params'] as Json | undefined
    const info = params?.['clientInfo'] ?? (params?.['_meta'] as Json | undefined)?.[META_CLIENT]
    if (!this.clientInfo && info && typeof info === 'object') this.clientInfo = pickInfo(info as Json)
    if (msg['method'] === 'tools/call' && 'id' in msg) {
      const params = (msg['params'] ?? {}) as Json
      const tool = typeof params['name'] === 'string' ? params['name'] : 'unknown'
      this.pending.set(idKey(msg['id']), { tool, inputHash: hashData(params['arguments'] ?? null), startedAt: this.now() })
    }
    if (msg['method'] === 'notifications/cancelled') {
      const id = (msg['params'] as Json | undefined)?.['requestId']
      const call = this.pending.get(idKey(id))
      if (call) {
        this.pending.delete(idKey(id))
        this.onRecord({ ...this.base(call), outputHash: null, status: 'failed', reason: 'cancelled' })
      }
    }
  }

  fromServer(msg: Json): void {
    if ('method' in msg || !('id' in msg)) return // a request or notification from the server
    const call = this.pending.get(idKey(msg['id']))
    if (!call) {
      // initialize's result.serverInfo, or result._meta in newer protocol revisions (server/discover)
      const result = msg['result'] as Json | undefined
      const info = result?.['serverInfo'] ?? (result?.['_meta'] as Json | undefined)?.[META_SERVER]
      if (!this.serverInfo && info && typeof info === 'object') this.serverInfo = pickInfo(info as Json)
      return
    }
    this.pending.delete(idKey(msg['id']))
    if ('error' in msg) {
      this.onRecord({ ...this.base(call), outputHash: hashData(msg['error'] ?? null), status: 'failed', reason: 'error' })
    } else {
      const result = (msg['result'] ?? null) as Json | null
      const isError = !!result && result['isError'] === true
      this.onRecord({ ...this.base(call), outputHash: hashData(result), status: isError ? 'failed' : 'completed', ...(isError ? { reason: 'is_error' as const } : {}) })
    }
  }

  /** The server went away: every call still waiting is a failure with no response. */
  abandonAll(): void {
    for (const call of this.pending.values()) this.onRecord({ ...this.base(call), outputHash: null, status: 'failed', reason: 'no_response' })
    this.pending.clear()
  }

  private base(call: PendingCall) {
    return { tool: call.tool, inputHash: call.inputHash, startedAt: call.startedAt, latencyMs: Math.max(0, this.now() - call.startedAt) }
  }
}

/** name and version only, as short strings: nothing else a client or server says about itself. */
function pickInfo(info: Json): Json {
  const out: Json = {}
  for (const k of ['name', 'version']) if (typeof info[k] === 'string') out[k] = (info[k] as string).slice(0, 100)
  return out
}

const RUNNERS = new Set(['node', 'nodejs', 'npx', 'pnpx', 'bunx', 'bun', 'deno', 'uvx', 'uv', 'python', 'python3', 'py', 'pipx'])
const RUNNER_WORDS = new Set(['run', 'exec', 'dlx', 'x', 'tool', '-m'])

/**
 * A server name safe for an action string (mcp.<name>.<tool>), from the
 * command: the program itself, or for a runner (npx, node, uvx, …) the
 * package or script it runs. `npx -y @scope/server-thing dir` → server-thing.
 */
export function serverNameFrom(command: string, args: string[]): string {
  const base = (p: string) => p.split(/[\\/]/).pop()!.replace(/\.(c|m)?js$|\.ts$|\.py$|\.exe$|\.cmd$|\.bat$/i, '')
  let target = command
  if (RUNNERS.has(base(command).toLowerCase())) {
    const arg = args.find((a) => !a.startsWith('-') && !RUNNER_WORDS.has(a))
    if (arg) target = arg
  }
  const raw = base(target).replace(/(?<=.)@[^/]*$/, '')
  return raw.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'server'
}

export interface ProxyOptions {
  command: string
  args: string[]
  name?: string
  dataDir?: string
  stdin?: Readable
  stdout?: Writable
  /** For tests: how to start the server. */
  spawn?: (command: string, args: string[]) => ChildProcess
}

export interface ProxyResult { code: number | null; signal: NodeJS.Signals | null; receipts: number }

/** Run the proxy until the server exits. Resolves with the server's exit code or signal. */
export async function runProxy(opts: ProxyOptions): Promise<ProxyResult> {
  const dataDir = opts.dataDir ?? ConfigManager.getDefaultDataDir()
  const name = opts.name ?? serverNameFrom(opts.command, opts.args)
  const chainId = `mcp_${name}_${randomUUID()}`
  const input = opts.stdin ?? process.stdin
  const output = opts.stdout ?? process.stdout
  const log = (m: string) => {
    try { mkdirSync(dataDir, { recursive: true }); appendFileSync(join(dataDir, 'proxy.log'), `${new Date().toISOString()} ${name}: ${m}\n`) } catch { /* silent */ }
  }

  const child = (opts.spawn ?? ((c, a) => crossSpawn(c, a, { stdio: ['pipe', 'pipe', 'inherit'] })))(opts.command, opts.args)

  // The signing side: opened in the background, one receipt at a time, after the response is forwarded
  let engine: Promise<{ store: SqliteReceiptStore; engine: ReceiptEngine }> | null = null
  const open = () => (engine ??= (async () => {
    process.env['AGENT_RECEIPTS_AGENT_ID'] = PROXY_AGENT_ID
    const store = new SqliteReceiptStore(dataDir); await store.init()
    const keys = new KeyManager(dataDir); await keys.init()
    const config = new ConfigManager(dataDir); await config.init()
    return { store, engine: new ReceiptEngine(store, keys, config) }
  })())
  let queue: Promise<void> = Promise.resolve()
  let receipts = 0
  const tracker = new CallTracker((r) => {
    queue = queue.then(async () => {
      try {
        const { engine: e } = await open()
        await e.create({
          action: `mcp.${name}.${r.tool}`,
          chain_id: chainId,
          status: r.status,
          input_hash: r.inputHash,
          output_hash: r.outputHash,
          latency_ms: r.latencyMs,
          started_at: new Date(r.startedAt).toISOString(),
          tool_calls: [r.tool],
          tags: ['mcp-proxy'],
          metadata: {
            mcp: {
              server: name,
              ...(tracker.serverInfo ? { server_info: tracker.serverInfo } : {}),
              ...(tracker.clientInfo ? { client_info: tracker.clientInfo } : {}),
              ...(r.reason ? { failure: r.reason } : {}),
            },
          },
        })
        receipts++
      } catch (err) {
        log(`could not sign a receipt for ${r.tool}: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  })

  const fromClient = new LineReader((line) => { for (const m of messagesIn(line)) try { tracker.fromClient(m) } catch { /* never in the way */ } })
  const fromServer = new LineReader((line) => { for (const m of messagesIn(line)) try { tracker.fromServer(m) } catch { /* never in the way */ } })

  // Client → server: forward first, then look
  const onInput = (chunk: Buffer) => {
    if (child.stdin && !child.stdin.destroyed) child.stdin.write(chunk)
    fromClient.push(chunk)
  }
  input.on('data', onInput)
  input.on('end', () => child.stdin?.end())
  child.stdin?.on('error', (err) => log(`server stdin: ${err.message}`))

  // Server → client: forward first, then look
  output.on('error', (err) => log(`client stdout: ${err.message}`))
  child.stdout?.on('data', (chunk: Buffer) => {
    output.write(chunk)
    fromServer.push(chunk)
  })

  // Signals for the proxy go to the server; the server's exit decides ours
  const forward = (sig: NodeJS.Signals) => () => { try { child.kill(sig) } catch { /* gone */ } }
  const handlers: Array<[NodeJS.Signals, () => void]> = (['SIGINT', 'SIGTERM', 'SIGHUP'] as NodeJS.Signals[]).map((s) => [s, forward(s)])
  if (!opts.stdin) for (const [s, h] of handlers) process.on(s, h)

  const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.on('error', (err) => { log(`could not start ${opts.command}: ${err.message}`); resolve({ code: 127, signal: null }) })
    child.on('close', (code, signal) => resolve({ code, signal }))
  })

  input.off('data', onInput)
  if (!opts.stdin) { for (const [s, h] of handlers) process.off(s, h); input.pause() }
  tracker.abandonAll()
  await Promise.race([queue, new Promise((r) => setTimeout(r, DRAIN_MS))])
  // (assigned in the signing closure, which TypeScript can't see)
  const opened = engine as Promise<{ store: SqliteReceiptStore }> | null
  if (opened) try { (await opened).store.close() } catch { /* closed */ }
  return { ...exit, receipts }
}

/** CLI entry: parse args, run, and leave with the server's exit code or signal. */
export async function proxyCommand(args: string[]): Promise<number> {
  const sep = args.indexOf('--')
  const own = sep >= 0 ? args.slice(0, sep) : args
  const rest = sep >= 0 ? args.slice(sep + 1) : []
  if (rest.length === 0) {
    process.stderr.write('Usage: agent-receipts proxy [--name <server-name>] -- <command> [args...]\n')
    return 1
  }
  const at = own.indexOf('--name')
  const name = at >= 0 && own[at + 1] ? own[at + 1]!.replace(/[^A-Za-z0-9_-]+/g, '-') : undefined
  const result = await runProxy({ command: rest[0]!, args: rest.slice(1), name })
  if (result.signal) {
    process.kill(process.pid, result.signal)
    return 1
  }
  return result.code ?? 1
}
