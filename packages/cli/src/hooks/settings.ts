/**
 * Add and remove the Agent Receipts hooks in Claude Code's settings.json,
 * leaving everything else in the file as it was.
 *
 * Settings locations (code.claude.com/docs/en/hooks#hook-locations):
 *   user     ~/.claude/settings.json
 *   project  <project>/.claude/settings.json        (shared, can be committed)
 *   local    <project>/.claude/settings.local.json  (just you, gitignored)
 */
import { homedir } from 'node:os'
import { join, basename } from 'node:path'

export type Scope = 'user' | 'project' | 'local'
export const SCOPES: Scope[] = ['user', 'project', 'local']

/** Our hook handlers are recognized by this script name, wherever it lives. */
export const HOOK_SCRIPT = 'agent-receipts-claude-code-hook.mjs'

/** File edits, file writes, notebook edits, and shell commands (PowerShell is the shell on Windows). */
export const TOOL_MATCHER = 'Edit|Write|NotebookEdit|Bash|PowerShell'

/** Seconds; raises SessionEnd's 1.5 s default budget so the summary has time to sign. */
export const SESSION_END_TIMEOUT = 10

export function settingsPath(scope: Scope, projectDir: string, home = homedir()): string {
  if (scope === 'user') return join(home, '.claude', 'settings.json')
  return join(projectDir, '.claude', scope === 'project' ? 'settings.json' : 'settings.local.json')
}

type Json = Record<string, unknown>
interface Handler { type?: string; command?: string; args?: unknown; [k: string]: unknown }
interface MatcherGroup { matcher?: string; hooks?: Handler[]; [k: string]: unknown }

export interface HookOptions {
  /** Absolute path of the installed hook script. */
  script: string
  storeCommands?: boolean
  /** Only when not the default ~/.agent-receipts. */
  dataDir?: string
  /**
   * For the Claude Code plugin: plugin hook timeouts don't raise SessionEnd's
   * 1.5 s budget, so the summary waits at most 1 s for tool hooks still signing.
   */
  plugin?: boolean
}

/** The hooks Agent Receipts adds, in settings.json's shape. Exec form: `node <script> <mode>`. */
export function ourHooks(opts: HookOptions): Record<string, MatcherGroup[]> {
  const extra = [...(opts.dataDir ? ['--data-dir', opts.dataDir] : [])]
  const tool = (): MatcherGroup => ({
    matcher: TOOL_MATCHER,
    hooks: [{ type: 'command', command: 'node', args: [opts.script, 'post-tool-use', ...(opts.storeCommands ? ['--store-commands'] : []), ...extra], async: true }],
  })
  return {
    PostToolUse: [tool()],
    // A failed tool call (e.g. a command that exits non-zero) fires this instead of PostToolUse
    PostToolUseFailure: [tool()],
    SessionEnd: [{
      hooks: [opts.plugin
        ? { type: 'command', command: 'node', args: [opts.script, 'session-end', '--inflight-wait-ms', '1000', ...extra] }
        : { type: 'command', command: 'node', args: [opts.script, 'session-end', ...extra], timeout: SESSION_END_TIMEOUT }],
    }],
  }
}

/** The plugin's hooks/hooks.json (plugins/agent-receipts in this repo). */
export function pluginHooksFile(): Record<string, unknown> {
  return {
    description: 'Agent Receipts: a signed receipt for every file edit, file write, notebook edit and shell command, and a session summary',
    hooks: ourHooks({ script: '${CLAUDE_PLUGIN_ROOT}/hooks/' + HOOK_SCRIPT, plugin: true }),
  }
}

export function isOurs(h: Handler): boolean {
  const first = Array.isArray(h.args) ? h.args[0] : undefined
  if (typeof first === 'string' && basename(first.replace(/\\/g, '/')) === HOOK_SCRIPT) return true
  return typeof h.command === 'string' && h.command.includes(HOOK_SCRIPT)
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const canonical = (v: unknown): string => JSON.stringify(v, (_k, x) =>
  x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Json)[k]])) : x)

/**
 * Settings with our hooks removed: handlers that run our script, plus any
 * handler identical to one install recorded adding (`added`). Groups and
 * events that held only our hooks go too, and so does an empty `hooks` object
 * that only held ours. Everything else stays as it is.
 */
export function removeOurHooks(settings: Json, added?: Record<string, unknown[]>): Json {
  const recorded = new Set(Object.values(added ?? {}).flatMap((groups) =>
    (groups as MatcherGroup[]).flatMap((g) => (g?.hooks ?? []).map(canonical))))
  const ours = (h: Handler) => isOurs(h) || recorded.has(canonical(h))
  const out = clone(settings)
  const hooks = out['hooks']
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) return out
  let removedAny = false
  for (const [event, groups] of Object.entries(hooks as Json)) {
    if (!Array.isArray(groups)) continue
    const kept: MatcherGroup[] = []
    for (const g of groups as MatcherGroup[]) {
      if (!g || !Array.isArray(g.hooks)) { kept.push(g); continue }
      const rest = g.hooks.filter((h) => !ours(h))
      if (rest.length === g.hooks.length) { kept.push(g); continue }
      removedAny = true
      if (rest.length > 0) kept.push({ ...g, hooks: rest })
    }
    if (kept.length > 0) (hooks as Json)[event] = kept
    else if (groups.length > 0) delete (hooks as Json)[event]
  }
  if (removedAny && Object.keys(hooks as Json).length === 0) delete out['hooks']
  return out
}

/** Settings with our hooks added (replacing any older copy of ours). Everything else is untouched. */
export function addOurHooks(settings: Json, opts: HookOptions): Json {
  const out = removeOurHooks(settings)
  const existing = out['hooks']
  if (existing !== undefined && (typeof existing !== 'object' || existing === null || Array.isArray(existing))) {
    throw new Error('"hooks" in this settings file is not an object; fix it by hand first')
  }
  const hooks = (existing ?? {}) as Json
  for (const [event, groups] of Object.entries(ourHooks(opts))) {
    const current = hooks[event]
    if (current !== undefined && !Array.isArray(current)) throw new Error(`"hooks.${event}" in this settings file is not a list; fix it by hand first`)
    hooks[event] = [...((current as MatcherGroup[] | undefined) ?? []), ...groups]
  }
  out['hooks'] = hooks
  return out
}

/** Which of our hook events a settings object has. */
export function installedEvents(settings: Json): string[] {
  const hooks = settings['hooks']
  if (!hooks || typeof hooks !== 'object') return []
  return Object.entries(hooks as Json)
    .filter(([, groups]) => Array.isArray(groups) && (groups as MatcherGroup[]).some((g) => Array.isArray(g?.hooks) && g.hooks.some(isOurs)))
    .map(([event]) => event)
}

/** The script path our hooks run, if installed. */
export function installedScript(settings: Json): string | null {
  for (const groups of Object.values((settings['hooks'] ?? {}) as Json)) {
    if (!Array.isArray(groups)) continue
    for (const g of groups as MatcherGroup[]) for (const h of g?.hooks ?? []) {
      if (isOurs(h) && Array.isArray(h.args) && typeof h.args[0] === 'string') return h.args[0]
    }
  }
  return null
}

/** Parse a settings file's text. Empty or missing means `{}`. */
export function parseSettings(text: string | null): Json {
  if (text === null || text.trim() === '') return {}
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('settings file is not a JSON object')
  return parsed as Json
}

/** Serialize the way the file was written: same indent, same trailing newline. */
export function formatSettings(settings: Json, original: string | null): string {
  const indentMatch = original?.match(/^[{[]\s*\n([ \t]+)/)
  const indent = indentMatch ? indentMatch[1]! : 2
  const trailing = original === null || original.endsWith('\n') ? '\n' : ''
  return JSON.stringify(settings, null, indent) + trailing
}

/** A unified-style line diff (no context trimming beyond 3 lines around changes). */
export function lineDiff(before: string, after: string): string {
  const a = before === '' ? [] : before.replace(/\n$/, '').split('\n')
  const b = after === '' ? [] : after.replace(/\n$/, '').split('\n')
  // LCS table
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
  }
  const ops: Array<[' ' | '-' | '+', string]> = []
  let i = 0, j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { ops.push([' ', a[i]!]); i++; j++ }
    // On a tie, show the removed line before the added one
    else if (i < a.length && (j >= b.length || dp[i + 1]![j]! >= dp[i]![j + 1]!)) { ops.push(['-', a[i]!]); i++ }
    else { ops.push(['+', b[j]!]); j++ }
  }
  const near = ops.map((_, k) => ops.slice(Math.max(0, k - 3), k + 4).some(([t]) => t !== ' '))
  const lines: string[] = []
  let skipped = false
  ops.forEach(([t, text], k) => {
    if (!near[k]) { if (!skipped) lines.push('  …'); skipped = true; return }
    skipped = false
    lines.push(`${t} ${text}`)
  })
  return lines.join('\n')
}
