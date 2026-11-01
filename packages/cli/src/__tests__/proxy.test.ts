import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm, readFile, mkdir, copyFile, writeFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PassThrough } from 'node:stream'
import { spawn } from 'node:child_process'
import crossSpawn from 'cross-spawn'
import { SqliteReceiptStore, KeyManager, ConfigManager, ReceiptEngine } from '@agent-receipts/mcp-server'
import type { ActionReceipt } from '@agent-receipts/schema'
import { runProxy, LineReader, CallTracker, serverNameFrom, PROXY_AGENT_ID, type ProxyResult } from '../proxy/proxy.js'

vi.setConfig({ testTimeout: 60_000 })

const here = dirname(fileURLToPath(import.meta.url))
const FAKE = join(here, 'fixtures', 'fake-mcp-server.mjs')
const CLI = join(here, '..', '..', 'dist', 'index.js')

let dir: string
let dataDir: string
let logDir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ar-proxy-'))
  dataDir = join(dir, 'data')
  logDir = join(dir, 'log')
  await mkdir(logDir)
})
afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

/** A client talking to the fake server through the proxy, in-process. */
function connect(opts: { command?: string; args?: string[]; name?: string; env?: Record<string, string> } = {}) {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const received: Buffer[] = []
  const sent: Buffer[] = []
  const waiters = new Map<string, (m: Record<string, unknown>) => void>()
  let pending = ''
  const messages: Array<Record<string, unknown>> = []
  stdout.on('data', (c: Buffer) => {
    received.push(c)
    pending += c.toString('utf8')
    let nl
    while ((nl = pending.indexOf('\n')) >= 0) {
      const m = JSON.parse(pending.slice(0, nl)) as Record<string, unknown>
      pending = pending.slice(nl + 1)
      messages.push(m)
      if (!('method' in m)) waiters.get(JSON.stringify(m['id']))?.(m)
    }
  })
  const done: Promise<ProxyResult> = runProxy({
    command: opts.command ?? process.execPath,
    args: opts.args ?? [FAKE],
    name: opts.name ?? 'fake',
    dataDir,
    stdin,
    stdout,
    spawn: (c, a) => crossSpawn(c, a, { stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, FAKE_LOG: logDir, ...opts.env } }),
  })
  const write = (raw: string) => { const b = Buffer.from(raw); sent.push(b); stdin.write(b) }
  const send = (msg: Record<string, unknown>) => write(JSON.stringify(msg) + '\n')
  const request = (id: unknown, method: string, params?: unknown) => {
    const p = new Promise<Record<string, unknown>>((resolve) => waiters.set(JSON.stringify(id), resolve))
    send({ jsonrpc: '2.0', id, method, ...(params !== undefined ? { params } : {}) })
    return p
  }
  const call = (id: unknown, name: string, args: unknown = {}, extra: Record<string, unknown> = {}) => request(id, 'tools/call', { name, arguments: args, ...extra })
  const close = () => { stdin.end(); return done }
  return { send, write, request, call, close, done, received, sent, messages }
}

async function receipts(): Promise<ActionReceipt[]> {
  const store = new SqliteReceiptStore(dataDir); await store.init()
  try {
    const { data } = await store.list({ agent_id: PROXY_AGENT_ID }, 1, 1000, 'timestamp:asc')
    return data
  } finally { store.close() }
}

async function verify(chainId: string) {
  const store = new SqliteReceiptStore(dataDir); await store.init()
  const keys = new KeyManager(dataDir); await keys.init()
  const config = new ConfigManager(dataDir); await config.init()
  try { return await new ReceiptEngine(store, keys, config).verifyChain(chainId) } finally { store.close() }
}

const init = (c: ReturnType<typeof connect>) => c.request(0, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test-client', version: '9.9' } })

describe('passthrough', () => {
  it('forwards every byte unchanged, both ways, including messages the proxy ignores', async () => {
    const c = connect()
    await init(c)
    c.send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    await c.request(1, 'tools/list')
    await c.request('r-2', 'resources/list')
    await c.request(3, 'ping')
    // Unusual but legal spacing and key order must survive untouched
    const p = new Promise((r) => setTimeout(r, 300))
    c.write('{ "id": 4, "jsonrpc":"2.0",   "method":"tools/call", "params":{"name":"echo","arguments":{"text":"hi ü"}} }\n')
    await p
    await new Promise((r) => setTimeout(r, 200))
    const result = await c.close()
    expect(result.code).toBe(0)
    expect(Buffer.concat(c.sent).equals(await readFile(join(logDir, 'in.bin')))).toBe(true)
    expect(Buffer.concat(c.received).equals(await readFile(join(logDir, 'out.bin')))).toBe(true)
  })

  it('a large message (2 MB, multi-byte characters split across chunks) passes through intact and is still observed', async () => {
    const c = connect()
    await init(c)
    const res = await c.call(1, 'big', { size: 1_000_000 })
    expect(((res['result'] as { content: Array<{ text: string }> }).content[0]!.text).length).toBe(1_000_000)
    await c.close()
    expect(Buffer.concat(c.received).equals(await readFile(join(logDir, 'out.bin')))).toBe(true)
    expect((await receipts()).map((r) => r.action)).toEqual(['mcp.fake.big'])
  })

  it('LineReader never splits a multi-byte character, whatever the chunking', () => {
    const lines: string[] = []
    const r = new LineReader((l) => lines.push(l))
    const bytes = Buffer.from('{"a":"é€😀"}\n{"b":1}\n')
    for (let i = 0; i < bytes.length; i++) r.push(bytes.subarray(i, i + 1))
    expect(lines).toEqual(['{"a":"é€😀"}', '{"b":1}'])
  })
})

describe('receipts for tools/call', () => {
  it('one signed v2 receipt per call: mcp.<name>.<tool>, one chain per proxy session, hashes only', async () => {
    const c = connect()
    await init(c)
    await c.call(1, 'echo', { text: 'SECRET-ARG', path: '/home/u/SECRET' })
    await c.call(2, 'echo', { text: 'again' })
    await c.request(3, 'tools/list') // not a tool call: no receipt
    await c.close()
    const rs = await receipts()
    expect(rs.map((r) => r.action)).toEqual(['mcp.fake.echo', 'mcp.fake.echo'])
    expect(new Set(rs.map((r) => r.chain_id)).size).toBe(1)
    expect(rs[0]!.chain_id).toMatch(/^mcp_fake_[0-9a-f-]{36}$/)
    expect(rs.every((r) => r.status === 'completed' && r.sig_version === 2 && r.agent_id === PROXY_AGENT_ID)).toBe(true)
    expect(rs[0]!.input_hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(rs[0]!.output_hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(rs[0]!.input_hash).not.toBe(rs[1]!.input_hash)
    expect(typeof rs[0]!.latency_ms).toBe('number')
    expect((rs[0]!.metadata as { mcp: unknown }).mcp).toEqual({ server: 'fake', server_info: { name: 'fake-server', version: '1.0.0' }, client_info: { name: 'test-client', version: '9.9' } })
    const all = JSON.stringify(rs) + (await readFile(join(dataDir, 'receipts.db'))).toString('latin1')
    expect(all).not.toContain('SECRET')
    expect(all).not.toContain('echo: again')
    const v = await verify(rs[0]!.chain_id)
    expect(v.problems).toEqual([])
  })

  it('isError results and JSON-RPC errors are failed receipts', async () => {
    const c = connect()
    await init(c)
    await c.call(1, 'fail')
    await c.call(2, 'rpc-error')
    await c.call(3, 'no-such-tool')
    await c.close()
    const rs = await receipts()
    expect(rs.map((r) => [r.action, r.status, (r.metadata as { mcp: { failure?: string } }).mcp.failure])).toEqual([
      ['mcp.fake.fail', 'failed', 'is_error'],
      ['mcp.fake.rpc-error', 'failed', 'error'],
      ['mcp.fake.no-such-tool', 'failed', 'error'],
    ])
    expect(JSON.stringify(rs)).not.toContain('SECRET')
  })

  it('interleaved concurrent calls are matched by id (numbers and strings), with progress in between', async () => {
    const c = connect()
    await init(c)
    const slow = c.call(1, 'slow', { ms: 400 }, { _meta: { progressToken: 'p1' } })
    const mid = c.call('1', 'slow', { ms: 200 }) // the string "1" is a different id from the number 1
    const fast = c.call(2, 'echo', { text: 'fast' })
    await Promise.all([slow, mid, fast])
    await c.close()
    expect(c.messages.some((m) => m['method'] === 'notifications/progress')).toBe(true)
    const rs = await receipts()
    expect(rs).toHaveLength(3)
    const byLatency = [...rs].sort((a, b) => (a.latency_ms ?? 0) - (b.latency_ms ?? 0))
    expect(byLatency.map((r) => r.action)).toEqual(['mcp.fake.echo', 'mcp.fake.slow', 'mcp.fake.slow'])
    expect(byLatency[2]!.latency_ms).toBeGreaterThanOrEqual(380)
    expect(byLatency[1]!.latency_ms).toBeGreaterThanOrEqual(180)
    // Windows pipes can deliver both responses in one read, so the two can tie
    expect(byLatency[1]!.latency_ms).toBeLessThanOrEqual(byLatency[2]!.latency_ms!)
    expect((await verify(rs[0]!.chain_id)).valid).toBe(true)
  })

  it('a server request whose id collides with a pending call is not mistaken for the response', async () => {
    const c = connect()
    await init(c)
    const answer = c.call(5, 'ask-client')
    // The server asks the client something with id 5; the client answers it, then the tool result comes
    await new Promise((r) => setTimeout(r, 200))
    const ask = c.messages.find((m) => m['method'] === 'sampling/createMessage')!
    expect(ask['id']).toBe(5)
    c.send({ jsonrpc: '2.0', id: 5, result: { role: 'assistant', content: { type: 'text', text: 'yes' }, model: 'm' } })
    const res = await answer
    expect(JSON.stringify(res)).toContain('client said yes')
    await c.close()
    const rs = await receipts()
    expect(rs.map((r) => [r.action, r.status])).toEqual([['mcp.fake.ask-client', 'completed']])
  })

  it('cancellation: a failed receipt marked cancelled; a late response is still forwarded', async () => {
    const c = connect()
    await init(c)
    c.send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'never', arguments: {} } })
    await new Promise((r) => setTimeout(r, 100))
    c.send({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 1, reason: 'user' } })
    await c.call(2, 'echo', { text: 'after' })
    await c.close()
    const rs = await receipts()
    expect(rs.map((r) => [r.action, r.status, (r.metadata as { mcp: { failure?: string } }).mcp.failure ?? null])).toEqual([
      ['mcp.fake.never', 'failed', 'cancelled'],
      ['mcp.fake.echo', 'completed', null],
    ])
  })

  it('reads client and server info from initialize, or from _meta (server/discover, protocol 2026-07-28)', () => {
    const t = new CallTracker(() => {})
    // As Claude Code 2.1.316 sends it
    t.fromClient({ jsonrpc: '2.0', id: 'server-discover-probe-1', method: 'server/discover', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'claude-code', title: 'Claude Code', version: '2.1.316', description: 'x' } } } })
    t.fromServer({ jsonrpc: '2.0', id: 'server-discover-probe-1', result: { supportedVersions: ['2026-07-28'], _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'secure-filesystem-server', version: '2.1.0' } } } })
    expect(t.clientInfo).toEqual({ name: 'claude-code', version: '2.1.316' })
    expect(t.serverInfo).toEqual({ name: 'secure-filesystem-server', version: '2.1.0' })
  })

  it('CallTracker ignores a response to a cancelled call', () => {
    const records: string[] = []
    const t = new CallTracker((r) => records.push(`${r.tool}:${r.status}:${r.reason ?? ''}`))
    t.fromClient({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'x', arguments: {} } })
    t.fromClient({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 7 } })
    t.fromServer({ jsonrpc: '2.0', id: 7, result: { content: [] } })
    expect(records).toEqual(['x:failed:cancelled'])
  })
})

describe('the server ends', () => {
  it('a crash mid-call: the pending call is a failed receipt with no response, and the exit code passes through', async () => {
    const c = connect()
    await init(c)
    await c.call(1, 'echo', { text: 'before' })
    c.send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'crash', arguments: {} } })
    const result = await c.done
    expect(result.code).toBe(3)
    const rs = await receipts()
    expect(rs.map((r) => [r.action, r.status, (r.metadata as { mcp: { failure?: string } }).mcp.failure ?? null])).toEqual([
      ['mcp.fake.echo', 'completed', null],
      ['mcp.fake.crash', 'failed', 'no_response'],
    ])
    expect((await verify(rs[0]!.chain_id)).valid).toBe(true)
  })

  it('the server\'s own exit code passes through when the client hangs up', async () => {
    const c = connect({ env: { FAKE_EXIT_CODE: '7' } })
    await init(c)
    expect((await c.close()).code).toBe(7)
  })

  it('a command that does not exist: exit 127, logged, nothing on stdout', async () => {
    const c = connect({ command: join(dir, 'no-such-server') })
    const result = await c.done
    expect(result.code).not.toBe(0)
    expect(Buffer.concat(c.received).length).toBe(0)
    expect(await readFile(join(dataDir, 'proxy.log'), 'utf-8')).toContain('could not start')
  })

  it.skipIf(process.platform === 'win32')('as a CLI: SIGTERM goes to the server, and the proxy ends the same way', async () => {
    const p = spawn(process.execPath, [CLI, 'proxy', '--name', 'fake', '--', process.execPath, FAKE], { env: { ...process.env, AGENT_RECEIPTS_DATA_DIR: dataDir }, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    p.stdout.on('data', (d) => { out += d })
    p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } }) + '\n')
    await new Promise<void>((r) => { const t = setInterval(() => { if (out.includes('fake-server')) { clearInterval(t); r() } }, 20) })
    const ended = new Promise<{ code: number | null; signal: string | null }>((r) => p.on('close', (code, signal) => r({ code, signal })))
    p.kill('SIGTERM')
    expect(await ended).toEqual({ code: null, signal: 'SIGTERM' })
  })

  it('as a CLI: the exit code passes through, and stdout carries only the server\'s bytes', async () => {
    const p = spawn(process.execPath, [CLI, 'proxy', '--', process.execPath, FAKE], { env: { ...process.env, AGENT_RECEIPTS_DATA_DIR: dataDir, FAKE_EXIT_CODE: '5', FAKE_LOG: logDir }, stdio: ['pipe', 'pipe', 'pipe'] })
    const chunks: Buffer[] = []
    p.stdout.on('data', (d: Buffer) => chunks.push(d))
    p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo', arguments: { text: 'x' } } }) + '\n')
    await new Promise((r) => setTimeout(r, 1500))
    p.stdin.end()
    const code = await new Promise((r) => p.on('close', r))
    expect(code).toBe(5)
    expect(Buffer.concat(chunks).equals(await readFile(join(logDir, 'out.bin')))).toBe(true)
    expect((await receipts()).map((r) => r.action)).toEqual(['mcp.fake-mcp-server.echo'])
  })
})

describe('starting the server', () => {
  it('paths and arguments with spaces, quotes and shell characters reach the server exactly (Windows quoting)', async () => {
    const spaced = join(dir, 'dir with spaces & (parens)')
    await mkdir(spaced)
    const server = join(spaced, 'fake server.mjs')
    await copyFile(FAKE, server)
    const args = ['plain', 'with space', 'with "quotes"', 'a&b|c', '100%', '^caret', 'trailing\\']
    // Through a shim, the way npx and other .cmd wrappers start servers on Windows
    const shim = process.platform === 'win32' ? join(spaced, 'run server.cmd') : join(spaced, 'run server')
    if (process.platform === 'win32') await writeFile(shim, `@"${process.execPath}" "%~dp0fake server.mjs" %*\r\n`)
    else { await writeFile(shim, `#!/bin/sh\nexec "${process.execPath}" "$(dirname "$0")/fake server.mjs" "$@"\n`); await chmod(shim, 0o755) }
    for (const [command, argv] of [[process.execPath, [server, ...args]], [shim, args]] as Array<[string, string[]]>) {
      const c = connect({ command, args: argv })
      await init(c)
      await c.close()
      expect(JSON.parse(await readFile(join(logDir, 'argv.json'), 'utf-8'))).toEqual(args)
    }
  })

  it('names the server from the command when --name is not given', () => {
    expect(serverNameFrom('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/x'])).toBe('server-filesystem')
    expect(serverNameFrom('node', ['/srv/my-mcp/dist/server.js'])).toBe('server')
    expect(serverNameFrom('uvx', ['mcp-server-git', '--repository', '.'])).toBe('mcp-server-git')
    expect(serverNameFrom('C:\\tools\\weather-mcp.exe', [])).toBe('weather-mcp')
    expect(serverNameFrom('npx', ['@acme/thing@1.2.3'])).toBe('thing')
  })
})
