/**
 * agent-receipts hooks install [--scope user|project|local] [--store-commands] [--yes]
 * agent-receipts hooks uninstall [--scope …] [--yes]
 * agent-receipts hooks status
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, unlinkSync, rmdirSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { ConfigManager, SqliteReceiptStore, isSupportedNode, MIN_NODE } from '@agent-receipts/mcp-server'
import {
  SCOPES, HOOK_SCRIPT, settingsPath, addOurHooks, removeOurHooks, installedEvents, installedScript,
  parseSettings, formatSettings, lineDiff, ourHooks, type Scope,
} from './settings.js'
import { AGENT_ID } from './claude-code.js'

/**
 * What install did, so uninstall can undo it: the hook entries it added and a
 * hash of the settings file as install left it. Nothing else from the
 * settings file is kept here (it can hold secrets in its env section).
 */
interface Install {
  scope: Scope
  settings: string
  /** Install created the settings file (it didn't exist before). */
  createdFile: boolean
  /** The matcher groups install added, per event. */
  added: Record<string, unknown[]>
  /** SHA-256 of the settings file right after install. */
  fileSha256: string
}
interface State { installs: Install[] }

const readText = (p: string): string | null => { try { return readFileSync(p, 'utf-8') } catch { return null } }
const sha256 = (p: string) => { try { return createHash('sha256').update(readFileSync(p)).digest('hex') } catch { return null } }
const sha256Text = (t: string) => createHash('sha256').update(t).digest('hex')

function statePath(dataDir: string) { return join(dataDir, 'hooks', 'installed.json') }
function readState(dataDir: string): State {
  try { return JSON.parse(readFileSync(statePath(dataDir), 'utf-8')) as State } catch { return { installs: [] } }
}
function writeState(dataDir: string, state: State) {
  mkdirSync(dirname(statePath(dataDir)), { recursive: true })
  writeFileSync(statePath(dataDir), JSON.stringify(state, null, 2) + '\n')
}

/** The hook script this CLI ships (dist/), copied next to the data so an npx cache clean-up can't break it. */
function bundledScript(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  // dist/index.js ships it alongside; from source (tests), use the built copy
  const found = [join(here, HOOK_SCRIPT), join(here, '..', '..', 'dist', HOOK_SCRIPT)].find((p) => sha256(p) !== null)
  if (!found) throw new Error(`${HOOK_SCRIPT} not found next to the CLI; reinstall @agent-receipts/cli`)
  return found
}
function installedScriptPath(dataDir: string) { return join(dataDir, 'hooks', HOOK_SCRIPT) }

function parseScope(args: string[], fallback: Scope): Scope {
  const i = args.indexOf('--scope')
  if (i < 0) return fallback
  const s = args[i + 1] as Scope
  if (!SCOPES.includes(s)) throw new Error(`--scope must be one of ${SCOPES.join(', ')}`)
  return s
}

async function confirm(question: string, yes: boolean): Promise<boolean> {
  if (yes) return true
  if (!process.stdin.isTTY) {
    console.log('\nNot changed: run again with --yes to apply (no terminal to ask in).')
    return false
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return /^y(es)?$/i.test((await rl.question(`${question} [y/N] `)).trim())
  } finally {
    rl.close()
  }
}

function showChange(path: string, before: string | null, after: string | null) {
  console.log(`\n${path}${before === null ? ' (new file)' : after === null ? ' (will be removed)' : ''}\n`)
  console.log(lineDiff(before ?? '', after ?? ''))
  console.log('')
}

export async function hooksCommand(args: string[], opts: { projectDir?: string; home?: string } = {}): Promise<number> {
  const sub = args[0]
  const yes = args.includes('--yes') || args.includes('-y')
  const dataDir = ConfigManager.getDefaultDataDir()
  const projectDir = opts.projectDir ?? process.cwd()
  const customDataDir = process.env['AGENT_RECEIPTS_DATA_DIR'] ? dataDir : undefined

  if (sub === 'install') {
    const scope = parseScope(args, 'user')
    const path = settingsPath(scope, projectDir, opts.home)
    const before = readText(path)
    let settings
    try { settings = parseSettings(before) } catch (e) {
      console.error(`Can't read ${path}: ${(e as Error).message}. Nothing changed.`)
      return 1
    }
    const script = installedScriptPath(dataDir)
    const hookOpts = { script, storeCommands: args.includes('--store-commands'), dataDir: customDataDir }
    const after = formatSettings(addOurHooks(settings, hookOpts), before)
    console.log(`Agent Receipts will sign a receipt for every file edit, file write, notebook edit and shell command Claude Code makes (${scope} scope), and a summary when the session ends.`)
    console.log(args.includes('--store-commands')
      ? 'Shell commands get a hash and a short redacted label (like "git commit"). No file contents or output are stored.'
      : 'Receipts hold hashes only: no commands, file contents or output.')
    if (before === after) { console.log(`\nAlready installed in ${path}.`) } else {
      showChange(path, before, after)
      if (!(await confirm('Apply this change?', yes))) return 1
    }
    mkdirSync(dirname(script), { recursive: true })
    copyFileSync(bundledScript(), script)
    if (before !== after) {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, after)
      const state = readState(dataDir)
      const prior = state.installs.find((i) => i.settings === path)
      state.installs = [...state.installs.filter((i) => i.settings !== path), {
        scope, settings: path, createdFile: prior?.createdFile ?? before === null, added: ourHooks(hookOpts), fileSha256: sha256Text(after),
      }]
      writeState(dataDir, state)
    }
    console.log(`Installed. Hook script: ${script}`)
    console.log('Start a new Claude Code session for the hooks to load. Check with: agent-receipts hooks status')
    return 0
  }

  if (sub === 'uninstall') {
    const scope = parseScope(args, 'user')
    const path = settingsPath(scope, projectDir, opts.home)
    const before = readText(path)
    if (before === null || installedEvents(parseSettings(before)).length === 0) {
      console.log(`Not installed in ${path}. Nothing to do.`)
      return 0
    }
    const state = readState(dataDir)
    const record = state.installs.find((i) => i.settings === path)
    // Remove our hook entries and nothing else
    const removed = removeOurHooks(parseSettings(before), record?.added)
    // A settings file that install created and nobody else has touched since goes away again
    const untouched = record?.createdFile && record.fileSha256 === sha256Text(before)
    const after = untouched && Object.keys(removed).length === 0 ? null : formatSettings(removed, before)
    showChange(path, before, after)
    if (!(await confirm('Apply this change?', yes))) return 1
    if (after === null) unlinkSync(path)
    else writeFileSync(path, after)
    state.installs = state.installs.filter((i) => i.settings !== path)
    writeState(dataDir, state)
    if (state.installs.length === 0) {
      try { unlinkSync(installedScriptPath(dataDir)) } catch { /* already gone */ }
      try { unlinkSync(statePath(dataDir)) } catch { /* already gone */ }
      try { const d = join(dataDir, 'hooks', 'inflight'); if (readdirSync(d).length === 0) rmdirSync(d) } catch { /* fine */ }
      try { const d = join(dataDir, 'hooks'); if (readdirSync(d).length === 0) rmdirSync(d) } catch { /* fine */ }
    }
    console.log('Uninstalled. Receipts already signed are kept.')
    return 0
  }

  if (sub === 'status') {
    const shipped = sha256(bundledScript())
    for (const scope of SCOPES) {
      const path = settingsPath(scope, projectDir, opts.home)
      const text = readText(path)
      let events: string[] = []
      let script: string | null = null
      try { const s = parseSettings(text); events = installedEvents(s); script = installedScript(s) } catch { /* unreadable */ }
      console.log(`${scope.padEnd(8)} ${events.length ? `installed (${events.join(', ')})` : 'not installed'}  ${path}`)
      if (script) {
        const hash = sha256(script)
        console.log(`         hook script ${hash === null ? 'MISSING' : hash === shipped ? 'up to date' : 'from another version (run hooks install again)'}: ${script}`)
        const record = readState(dataDir).installs.find((i) => i.settings === path)
        if (record && text !== null && record.fileSha256 !== sha256Text(text)) console.log('         settings file changed since install (fine; uninstall removes only our entries)')
      }
    }
    const node = spawnSync('node', ['-v'], { encoding: 'utf-8', shell: process.platform === 'win32' })
    const v = node.stdout?.trim().replace(/^v/, '') ?? ''
    console.log(`node on PATH: ${v ? `v${v} ${isSupportedNode(v) ? '✓' : `(needs ${MIN_NODE} or later: hooks will only log an error)`}` : 'not found (hooks can\'t run)'}`)
    try {
      const store = new SqliteReceiptStore(dataDir)
      await store.init()
      console.log(`Claude Code receipts: ${await store.count({ agent_id: AGENT_ID })}`)
      store.close()
    } catch { /* no store yet */ }
    const log = readText(join(dataDir, 'hooks.log'))
    const lines = log ? log.trim().split('\n') : []
    console.log(lines.length ? `hooks.log: ${lines.length} problem(s), latest: ${lines[lines.length - 1]}` : 'hooks.log: no problems logged')
    return 0
  }

  console.log(`Usage:
  agent-receipts hooks install [--scope user|project|local] [--store-commands] [--yes]
  agent-receipts hooks uninstall [--scope user|project|local] [--yes]
  agent-receipts hooks status`)
  return sub ? 1 : 0
}

