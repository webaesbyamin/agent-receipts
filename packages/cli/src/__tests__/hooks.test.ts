import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { SqliteReceiptStore, KeyManager, ConfigManager, ReceiptEngine } from '@agent-receipts/mcp-server'
import type { ActionReceipt } from '@agent-receipts/schema'
import { runHook, commandLabel, parseHookArgs, SESSION_END_ACTION, INFLIGHT_WAIT_MS } from '../hooks/claude-code.js'
import {
  addOurHooks, removeOurHooks, installedEvents, parseSettings, formatSettings, lineDiff, ourHooks, isOurs, settingsPath, pluginHooksFile, HOOK_SCRIPT, TOOL_MATCHER,
} from '../hooks/settings.js'
import { hooksCommand } from '../hooks/commands.js'

// Each hook signs and stores in a fresh process or store; Windows CI runners are slow at that
vi.setConfig({ testTimeout: 60_000 })

const here = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(here, 'fixtures', 'hooks')
const HOOK_BUNDLE = join(here, '..', '..', 'dist', HOOK_SCRIPT)
const SECRETS = ['SECRET', 'ghp_', 'user:pass', 'const a = 2', 'print(42)', 'express']

let dir: string
let cwd: string
let dataDir: string

/** A hook input fixture with this test's session and project directory filled in. */
function fixture(name: string, session = 'sess-1'): string {
  const raw = readFileSync(join(FIXTURES, `${name}.json`), 'utf-8')
  return raw.replaceAll('{{cwd}}', JSON.stringify(cwd).slice(1, -1)).replaceAll('{{session}}', session)
}

async function chain(session: string): Promise<ActionReceipt[]> {
  const store = new SqliteReceiptStore(dataDir)
  await store.init()
  try { return await store.getChain(session) } finally { store.close() }
}

async function verifyChain(session: string) {
  const store = new SqliteReceiptStore(dataDir)
  await store.init()
  const keys = new KeyManager(dataDir); await keys.init()
  const config = new ConfigManager(dataDir); await config.init()
  try { return await new ReceiptEngine(store, keys, config).verifyChain(session) } finally { store.close() }
}

const sha = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ar-hooks-'))
  cwd = join(dir, 'project')
  dataDir = join(dir, 'data')
  await mkdir(join(cwd, 'src'), { recursive: true })
  await mkdir(join(cwd, 'notes'), { recursive: true })
  await writeFile(join(cwd, 'src', 'app.ts'), 'const a = 2\n')
  await writeFile(join(cwd, 'notes', 'todo.md'), 'SECRET-CONTENT do not store')
  await writeFile(join(cwd, 'analysis.ipynb'), '{"cells":[]}')
})
afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

describe('hook input for every tool type', () => {
  it('Edit: one signed receipt, the file hashed after the edit, path relative to cwd', async () => {
    await runHook(['post-tool-use', '--data-dir', dataDir], fixture('edit'))
    const [r] = await chain('sess-1')
    expect(r!.action).toBe('claude_code.Edit')
    expect(r!.agent_id).toBe('claude-code')
    expect(r!.chain_id).toBe('sess-1')
    expect(r!.status).toBe('completed')
    expect(r!.sig_version).toBe(2)
    expect(r!.files).toEqual([{ name: 'src/app.ts', sha256: sha('const a = 2\n'), bytes: 12, role: 'output' }])
    expect(r!.latency_ms).toBe(9)
    expect((r!.metadata as { claude_code: Record<string, unknown> }).claude_code).toEqual({ event: 'PostToolUse', tool_use_id: 'toolu_01EDIT' })
  })

  it('Write and NotebookEdit hash the written file', async () => {
    await runHook(['post-tool-use', '--data-dir', dataDir], fixture('write'))
    await runHook(['post-tool-use', '--data-dir', dataDir], fixture('notebook-edit'))
    const rs = await chain('sess-1')
    expect(rs.map((r) => r.action).sort()).toEqual(['claude_code.NotebookEdit', 'claude_code.Write'])
    expect(rs.flatMap((r) => r.files ?? []).map((f) => f.name).sort()).toEqual(['analysis.ipynb', 'notes/todo.md'])
  })

  it('Bash: input and output hashed, changed files from bashEditDiff, missing ones listed by name', async () => {
    await runHook(['post-tool-use', '--data-dir', dataDir], fixture('bash'))
    const [r] = await chain('sess-1')
    expect(r!.action).toBe('claude_code.Bash')
    expect(r!.files!.map((f) => f.name)).toEqual(['src/app.ts'])
    const cc = (r!.metadata as { claude_code: Record<string, unknown> }).claude_code
    expect(cc['files_missing']).toEqual(['gone.txt'])
    expect(cc['command_label']).toBeUndefined()
    expect(cc['command_hash']).toBeUndefined()
    expect(r!.input_hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(r!.output_hash).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('a failed command (PostToolUseFailure) is a failed receipt with the error hashed', async () => {
    await runHook(['post-tool-use', '--data-dir', dataDir], fixture('bash-failure'))
    const [r] = await chain('sess-1')
    expect(r!.status).toBe('failed')
    expect(r!.output_hash).toMatch(/^sha256:/)
    expect((r!.metadata as { claude_code: { event: string } }).claude_code.event).toBe('PostToolUseFailure')
  })

  it('PowerShell and subagent calls are recorded too', async () => {
    await runHook(['post-tool-use', '--data-dir', dataDir], fixture('powershell'))
    await runHook(['post-tool-use', '--data-dir', dataDir], fixture('subagent-edit'))
    const rs = await chain('sess-1')
    expect(rs.map((r) => r.action).sort()).toEqual(['claude_code.Edit', 'claude_code.PowerShell'])
    const sub = rs.find((r) => r.action === 'claude_code.Edit')!
    expect((sub.metadata as { claude_code: Record<string, unknown> }).claude_code['subagent']).toBe('Explore')
  })
})

describe('redaction', () => {
  it('stores no raw commands, file contents, output or errors by default', async () => {
    for (const f of ['edit', 'write', 'notebook-edit', 'bash', 'bash-failure', 'powershell']) {
      await runHook(['post-tool-use', '--data-dir', dataDir], fixture(f))
    }
    const all = JSON.stringify(await chain('sess-1'))
    for (const s of SECRETS) expect(all).not.toContain(s)
    const db = await readFile(join(dataDir, 'receipts.db'))
    for (const s of SECRETS) expect(db.includes(Buffer.from(s))).toBe(false)
  })

  it('--store-commands adds a command hash and a short label that keeps no secrets', async () => {
    await runHook(['post-tool-use', '--data-dir', dataDir, '--store-commands'], fixture('bash'))
    await runHook(['post-tool-use', '--data-dir', dataDir, '--store-commands'], fixture('edit'))
    const rs = await chain('sess-1')
    const bash = rs.find((r) => r.action === 'claude_code.Bash')!
    const cc = (bash.metadata as { claude_code: Record<string, unknown> }).claude_code
    expect(cc['command_label']).toBe('git commit …')
    expect(cc['command_hash']).toMatch(/^sha256:[0-9a-f]{64}$/)
    const edit = rs.find((r) => r.action === 'claude_code.Edit')!
    expect((edit.metadata as { claude_code: Record<string, unknown> }).claude_code['command_label']).toBeUndefined()
    for (const s of SECRETS) expect(JSON.stringify(rs)).not.toContain(s)
  })

  it('commandLabel keeps only a program and a subcommand-looking word', () => {
    expect(commandLabel('npm test')).toBe('npm test')
    expect(commandLabel('git status')).toBe('git status')
    expect(commandLabel('ls')).toBe('ls')
    expect(commandLabel('GITHUB_TOKEN=ghp_x git push origin main')).toBe('git push …')
    expect(commandLabel('sudo -E rm -rf /tmp/x')).toBe('rm …')
    expect(commandLabel('sudo rm -rf /tmp/x')).toBe('rm …')
    expect(commandLabel('curl -H "Authorization: Bearer abc" https://api.example.com')).toBe('curl …')
    expect(commandLabel('psql postgres://u:p@db/x -c "select 1"')).toBe('psql …')
    expect(commandLabel('/usr/local/bin/node script.js --key=abc')).toBe('node …')
    expect(commandLabel('cat .env | grep KEY')).toBe('cat …')
    expect(commandLabel('echo $SECRET')).toBe('echo …')
    expect(commandLabel('"$HOME/bin/deploy" --prod')).toBe('…')
    expect(commandLabel('npm run build\nnpm test')).toBe('npm run …')
    expect(commandLabel('git commit -m "fix" && git push')).toBe('git commit …')
  })
})

describe('chain integrity over a simulated session', () => {
  it('every tool call and the summary link into one verified chain per session', async () => {
    const steps = ['edit', 'write', 'bash', 'bash-failure', 'notebook-edit', 'powershell', 'subagent-edit']
    for (const f of steps) await runHook(['post-tool-use', '--data-dir', dataDir], fixture(f))
    // Another session at the same time stays in its own chain
    await runHook(['post-tool-use', '--data-dir', dataDir], fixture('edit', 'sess-2'))
    await runHook(['session-end', '--data-dir', dataDir], fixture('session-end'))

    const rs = await chain('sess-1')
    expect(rs).toHaveLength(steps.length + 1)
    const summary = rs.find((r) => r.action === SESSION_END_ACTION)!
    const s = (summary.metadata as { claude_code: { summary: Record<string, unknown> } }).claude_code.summary
    expect(s['actions']).toBe(7)
    expect(s['failed']).toBe(1)
    expect(s['by_tool']).toEqual({ Edit: 2, Write: 1, Bash: 2, NotebookEdit: 1, PowerShell: 1 })
    expect(s['files']).toEqual(['analysis.ipynb', 'notes/todo.md', 'src/app.ts'])
    expect(s['files_touched']).toBe(3)
    expect(s['reason']).toBe('prompt_input_exit')
    expect(typeof s['duration_ms']).toBe('number')

    const v = await verifyChain('sess-1')
    expect(v.problems).toEqual([])
    expect(v.valid).toBe(true)
    expect((await verifyChain('sess-2')).valid).toBe(true)
  })

  it('concurrent hooks (as async hooks run) still form one unforked chain', async () => {
    const files = ['edit', 'write', 'bash', 'notebook-edit', 'powershell', 'bash-failure']
    await Promise.all(files.map((f) => runBundle(['post-tool-use', '--data-dir', dataDir], fixture(f))))
    const v = await verifyChain('sess-1')
    expect(v.problems).toEqual([])
    expect(v.valid).toBe(true)
    expect(v.receipts).toHaveLength(files.length)
    const rs = await chain('sess-1')
    // Exactly one receipt starts the chain; every other one links to a different predecessor
    expect(rs.filter((r) => !r.prev_receipt_hash)).toHaveLength(1)
    expect(new Set(rs.map((r) => r.prev_receipt_hash)).size).toBe(files.length)
  }, 60_000)

  it('editing an earlier receipt makes verify-chain fail', async () => {
    await runHook(['post-tool-use', '--data-dir', dataDir], fixture('edit'))
    await runHook(['post-tool-use', '--data-dir', dataDir], fixture('write'))
    const store = new SqliteReceiptStore(dataDir)
    await store.init()
    const [first] = await store.getChain('sess-1')
    const edited = { ...first!, action: 'claude_code.Read' }
    store.getDb().prepare('UPDATE receipts SET data = ? WHERE receipt_id = ?').run(JSON.stringify(edited), first!.receipt_id)
    store.close()
    expect((await verifyChain('sess-1')).valid).toBe(false)
  })
})

describe('a hook never blocks or breaks Claude Code', () => {
  it('bad input, an unknown mode or an unwritable store: logged, exit 0, nothing on stdout', async () => {
    for (const [args, input] of [
      [['post-tool-use'], 'not json {"command":"SECRET"'],
      [['post-tool-use'], '{}'],
      [['nonsense'], fixture('edit')],
    ] as Array<[string[], string]>) {
      const { code, stdout } = await runBundle([...args, '--data-dir', dataDir], input)
      expect(code).toBe(0)
      expect(stdout).toBe('')
    }
    // The data dir is a file: the store can't open
    const blocked = join(dir, 'blocked')
    await writeFile(blocked, 'x')
    const r = await runBundle(['post-tool-use', '--data-dir', join(blocked, 'data')], fixture('edit'))
    expect(r.code).toBe(0)
    expect(r.stdout).toBe('')

    const log = await readFile(join(dataDir, 'hooks.log'), 'utf-8')
    expect(log).toContain('hook input is not valid JSON')
    expect(log).toContain('no session_id')
    expect(log).toContain('unknown hook mode')
    expect(log).not.toContain('SECRET')
  }, 60_000)
})

describe('settings.json merge', () => {
  const script = '/home/u/.agent-receipts/hooks/' + HOOK_SCRIPT
  const existing = {
    model: 'opus',
    permissions: { allow: ['Bash(npm test)'] },
    hooks: {
      PostToolUse: [{ matcher: 'Write|Edit', hooks: [{ type: 'command', command: '/home/u/lint.sh' }] }],
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/home/u/guard.sh' }] }],
    },
  }

  it('adds our hooks without touching existing ones', () => {
    const out = addOurHooks(existing, { script }) as typeof existing & { hooks: Record<string, unknown[]> }
    expect(out.model).toBe('opus')
    expect(out.permissions).toEqual(existing.permissions)
    expect(out.hooks.PreToolUse).toEqual(existing.hooks.PreToolUse)
    expect(out.hooks.PostToolUse[0]).toEqual(existing.hooks.PostToolUse[0])
    expect(out.hooks.PostToolUse).toHaveLength(2)
    expect(installedEvents(out)).toEqual(['PostToolUse', 'PostToolUseFailure', 'SessionEnd'])
  })

  it('uses the documented shape: exec form, async tool hooks, the tool matcher, a SessionEnd timeout', () => {
    const h = ourHooks({ script })
    expect(h['PostToolUse']![0]!.matcher).toBe(TOOL_MATCHER)
    expect(h['PostToolUse']![0]!.hooks![0]).toEqual({ type: 'command', command: 'node', args: [script, 'post-tool-use'], async: true })
    expect(h['PostToolUseFailure']![0]!.hooks![0]!.async).toBe(true)
    expect(h['SessionEnd']![0]!.matcher).toBeUndefined()
    expect(h['SessionEnd']![0]!.hooks![0]).toEqual({ type: 'command', command: 'node', args: [script, 'session-end'], timeout: 10 })
    expect(ourHooks({ script, storeCommands: true, dataDir: '/d' })['PostToolUse']![0]!.hooks![0]!.args).toEqual([script, 'post-tool-use', '--store-commands', '--data-dir', '/d'])
  })

  it('installing twice keeps one copy', () => {
    const twice = addOurHooks(addOurHooks(existing, { script }), { script: '/elsewhere/' + HOOK_SCRIPT })
    expect((twice['hooks'] as Record<string, unknown[]>)['PostToolUse']).toHaveLength(2)
    expect(JSON.stringify(twice)).not.toContain('/home/u/.agent-receipts')
  })

  it('uninstall restores the original exactly, for several starting points', () => {
    const cases: Record<string, unknown>[] = [
      {},
      existing,
      { hooks: { SessionEnd: [{ hooks: [{ type: 'command', command: 'say bye' }] }] } },
      { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] }, env: { A: '1' } },
    ]
    for (const original of cases) {
      const text = formatSettings(original, '{\n    "x": 1\n}\n')
      const roundTrip = formatSettings(removeOurHooks(addOurHooks(parseSettings(text), { script })), text)
      expect(roundTrip).toBe(text)
    }
  })

  it('recognizes our handlers by script name, on any OS path', () => {
    expect(isOurs({ command: 'node', args: ['C:\\Users\\u\\.agent-receipts\\hooks\\' + HOOK_SCRIPT, 'post-tool-use'] })).toBe(true)
    expect(isOurs({ command: 'node', args: ['/x/other-hook.mjs'] })).toBe(false)
    expect(isOurs({ command: '/home/u/lint.sh' })).toBe(false)
  })

  it('keeps the file\'s indent and trailing newline, and shows a readable diff', () => {
    const original = '{\n\t"model": "opus"\n}'
    const after = formatSettings(addOurHooks(parseSettings(original), { script }), original)
    expect(after.startsWith('{\n\t"model"')).toBe(true)
    expect(after.endsWith('}')).toBe(true)
    const diff = lineDiff(original, after)
    expect(diff).toContain('+ \t"hooks": {')
    // Only the line that gains a comma is replaced
    expect(diff.split('\n').filter((l) => l.startsWith('- '))).toEqual(['- \t"model": "opus"'])
  })

  it('settings locations follow the docs', () => {
    expect(settingsPath('user', '/p', '/home/u')).toBe(join('/home/u', '.claude', 'settings.json'))
    expect(settingsPath('project', '/p', '/home/u')).toBe(join('/p', '.claude', 'settings.json'))
    expect(settingsPath('local', '/p', '/home/u')).toBe(join('/p', '.claude', 'settings.local.json'))
  })
})

describe('hooks install / uninstall / status', () => {
  it('install at project scope, then uninstall: the original file comes back byte for byte', async () => {
    const prev = process.env['AGENT_RECEIPTS_DATA_DIR']
    process.env['AGENT_RECEIPTS_DATA_DIR'] = dataDir
    const log = console.log
    console.log = () => {}
    try {
      const path = join(cwd, '.claude', 'settings.json')
      await mkdir(dirname(path), { recursive: true })
      const original = JSON.stringify(existing(), null, 2) + '\n'
      await writeFile(path, original)

      expect(await hooksCommand(['install', '--scope', 'project', '--yes'], { projectDir: cwd, home: dir })).toBe(0)
      const installed = parseSettings(await readFile(path, 'utf-8'))
      expect(installedEvents(installed)).toEqual(['PostToolUse', 'PostToolUseFailure', 'SessionEnd'])
      expect(existsSync(join(dataDir, 'hooks', HOOK_SCRIPT))).toBe(true)

      expect(await hooksCommand(['uninstall', '--scope', 'project', '--yes'], { projectDir: cwd, home: dir })).toBe(0)
      expect(await readFile(path, 'utf-8')).toBe(original)
      expect(existsSync(join(dataDir, 'hooks', HOOK_SCRIPT))).toBe(false)
    } finally {
      console.log = log
      process.env['AGENT_RECEIPTS_DATA_DIR'] = prev
    }
  })

  it('a hand-formatted file comes back byte for byte; a change made after install is kept', async () => {
    const prev = process.env['AGENT_RECEIPTS_DATA_DIR']
    process.env['AGENT_RECEIPTS_DATA_DIR'] = dataDir
    const log = console.log
    console.log = () => {}
    try {
      const path = join(cwd, '.claude', 'settings.json')
      await mkdir(dirname(path), { recursive: true })
      const original = '{\n  "permissions": {\n    "allow": ["Bash(ls *)", "Read"]\n  },\n  "model":"opus"\n}'
      await writeFile(path, original)
      await hooksCommand(['install', '--scope', 'project', '--yes'], { projectDir: cwd, home: dir })
      await hooksCommand(['uninstall', '--scope', 'project', '--yes'], { projectDir: cwd, home: dir })
      expect(await readFile(path, 'utf-8')).toBe(original)

      await hooksCommand(['install', '--scope', 'project', '--yes'], { projectDir: cwd, home: dir })
      const changed = parseSettings(await readFile(path, 'utf-8'))
      changed['model'] = 'sonnet'
      await writeFile(path, JSON.stringify(changed, null, 2))
      await hooksCommand(['uninstall', '--scope', 'project', '--yes'], { projectDir: cwd, home: dir })
      const after = parseSettings(await readFile(path, 'utf-8'))
      expect(after).toEqual({ permissions: { allow: ['Bash(ls *)', 'Read'] }, model: 'sonnet' })
    } finally {
      console.log = log
      process.env['AGENT_RECEIPTS_DATA_DIR'] = prev
    }
  })

  it('a settings file that install created is removed again by uninstall', async () => {
    const prev = process.env['AGENT_RECEIPTS_DATA_DIR']
    process.env['AGENT_RECEIPTS_DATA_DIR'] = dataDir
    const log = console.log
    console.log = () => {}
    try {
      const path = join(cwd, '.claude', 'settings.local.json')
      expect(await hooksCommand(['install', '--scope', 'local', '--yes'], { projectDir: cwd, home: dir })).toBe(0)
      expect(existsSync(path)).toBe(true)
      expect(await hooksCommand(['uninstall', '--scope', 'local', '--yes'], { projectDir: cwd, home: dir })).toBe(0)
      expect(existsSync(path)).toBe(false)
    } finally {
      console.log = log
      process.env['AGENT_RECEIPTS_DATA_DIR'] = prev
    }
  })

  it('without --yes and without a terminal, nothing changes', async () => {
    const prev = process.env['AGENT_RECEIPTS_DATA_DIR']
    process.env['AGENT_RECEIPTS_DATA_DIR'] = dataDir
    const log = console.log
    console.log = () => {}
    try {
      expect(await hooksCommand(['install', '--scope', 'project'], { projectDir: cwd, home: dir })).toBe(1)
      expect(existsSync(join(cwd, '.claude', 'settings.json'))).toBe(false)
    } finally {
      console.log = log
      process.env['AGENT_RECEIPTS_DATA_DIR'] = prev
    }
  })

  it('refuses to touch a settings file it cannot parse', async () => {
    const path = join(cwd, '.claude', 'settings.json')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, '{ "model": "opus", // a comment\n}')
    const err = console.error
    console.error = () => {}
    try {
      expect(await hooksCommand(['install', '--scope', 'project', '--yes'], { projectDir: cwd, home: dir })).toBe(1)
    } finally {
      console.error = err
    }
    expect(await readFile(path, 'utf-8')).toBe('{ "model": "opus", // a comment\n}')
  })

  function existing() {
    return { model: 'opus', hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/home/u/guard.sh' }] }] } }
  }
})

/** Run the built hook bundle the way Claude Code does: a new process, input on stdin. */
function runBundle(args: string[], input: string): Promise<{ code: number | null; stdout: string; ms: number }> {
  return new Promise((resolve, reject) => {
    const t = performance.now()
    const p = spawn(process.execPath, [HOOK_BUNDLE, ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    p.stdout.on('data', (d) => { stdout += d })
    p.on('error', reject)
    p.on('close', (code) => resolve({ code, stdout, ms: performance.now() - t }))
    p.stdin.end(input)
  })
}

describe('the Claude Code plugin (plugins/agent-receipts)', () => {
  const plugin = join(here, '..', '..', '..', '..', 'plugins', 'agent-receipts')

  it('runs the same hook as the CLI, and its hooks.json comes from the same code', async () => {
    const hooksJson = JSON.parse(await readFile(join(plugin, 'hooks', 'hooks.json'), 'utf-8'))
    expect(hooksJson).toEqual(pluginHooksFile())
    const sum = async (p: string) => createHash('sha256').update(await readFile(p)).digest('hex')
    expect(await sum(join(plugin, 'hooks', HOOK_SCRIPT))).toBe(await sum(HOOK_BUNDLE))
  })

  it('names itself consistently in its manifest and the marketplace', async () => {
    const manifest = JSON.parse(await readFile(join(plugin, '.claude-plugin', 'plugin.json'), 'utf-8'))
    const market = JSON.parse(await readFile(join(plugin, '..', '..', '.claude-plugin', 'marketplace.json'), 'utf-8'))
    const entry = market.plugins.find((p: { name: string }) => p.name === manifest.name)
    expect(entry.source).toBe('./plugins/agent-receipts')
  })

  it('waits at most 1 s at session end (plugin hook timeouts do not raise the 1.5 s budget)', () => {
    const args = (pluginHooksFile() as { hooks: Record<string, Array<{ hooks: Array<{ args: string[]; timeout?: number }> }>> }).hooks['SessionEnd']![0]!.hooks[0]!
    expect(args.timeout).toBeUndefined()
    expect(parseHookArgs(args.args.slice(1)).inflightWaitMs).toBe(1000)
    expect(parseHookArgs(['session-end']).inflightWaitMs).toBe(INFLIGHT_WAIT_MS)
  })
})

describe('timing', () => {
  it('one tool call, signed and stored in its own process, takes well under a second', async () => {
    await runBundle(['post-tool-use', '--data-dir', dataDir], fixture('edit')) // first run creates keys and the database
    const times: number[] = []
    for (let i = 0; i < 10; i++) times.push((await runBundle(['post-tool-use', '--data-dir', dataDir], fixture(i % 2 ? 'bash' : 'edit'))).ms)
    times.sort((a, b) => a - b)
    const p50 = times[Math.floor(times.length / 2)]!
    // About 100 ms on a laptop; Claude Code runs it async, so it never waits. Generous for CI runners.
    expect(p50).toBeLessThan(1500)
    expect((await chain('sess-1')).length).toBe(11)
  }, 60_000)
})
