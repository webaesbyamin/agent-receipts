import { buildPrompt, isInside } from './executor.js'
import type { Executor, ExecResult, JobContext } from './executor.js'

/**
 * Runs a job with the Claude Agent SDK.
 *
 * - Needs `@anthropic-ai/claude-agent-sdk` installed next to this package and
 *   an ANTHROPIC_API_KEY. (Anthropic doesn't allow third-party products to
 *   use claude.ai logins, so this is API-key only.)
 * - The agent runs with cwd = the job folder and only the recipe's tools.
 *   Every file path a tool touches must be inside the job folder; writes must
 *   be inside output/. Anything else is denied.
 * - Cost comes from the SDK's result message. It is a client-side estimate:
 *   receipts label it as estimated, and credits (not this number) are what
 *   people pay.
 */
export class ClaudeExecutor implements Executor {
  readonly name = 'claude-agent-sdk'

  constructor(private readonly options: {
    model?: string
    maxTurns?: number
    /** For tests: supply the SDK module instead of importing it */
    loadSdk?: () => Promise<unknown>
  } = {}) {}

  async run(job: JobContext): Promise<ExecResult> {
    let sdk: ClaudeAgentSdk
    try {
      sdk = (await (this.options.loadSdk ? this.options.loadSdk() : import('@anthropic-ai/claude-agent-sdk' as string))) as ClaudeAgentSdk
    } catch {
      return failure('The Claude Agent SDK is not installed. Run: npm install @anthropic-ai/claude-agent-sdk')
    }
    if (!process.env['ANTHROPIC_API_KEY']) {
      return failure('ANTHROPIC_API_KEY is not set.')
    }

    const abortController = new AbortController()
    job.signal.addEventListener('abort', () => abortController.abort(), { once: true })

    const toolCalls: string[] = []
    let lastText = ''
    let result: SdkResultMessage | null = null
    let model: string | null = job.recipe.model ?? this.options.model ?? null

    try {
      const gate = async (hookInput: { tool_name?: unknown; tool_input?: unknown }) => {
        const decision = checkToolUse(job, String(hookInput.tool_name ?? ''), (hookInput.tool_input ?? {}) as Record<string, unknown>)
        return decision.behavior === 'deny'
          ? { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: decision.message } }
          : {}
      }
      const stream = sdk.query({
        prompt: buildPrompt(job),
        options: {
          cwd: job.workDir,
          model: job.recipe.model ?? this.options.model,
          // Nothing is pre-approved (allow rules would skip canUseTool).
          // The PreToolUse hook runs before any permission rule and fences
          // every call; canUseTool repeats the check as a second layer.
          disallowedTools: DISALLOWED_TOOLS.filter((t) => !(job.recipe.tools as string[]).includes(t)),
          hooks: { PreToolUse: [{ hooks: [gate] }] },
          canUseTool: async (toolName: string, input: Record<string, unknown>) =>
            checkToolUse(job, toolName, input),
          permissionMode: 'default',
          maxTurns: this.options.maxTurns ?? 20,
          maxBudgetUsd: job.recipe.maxCostUsd,
          settingSources: [],
          abortController,
        },
      })

      for await (const message of stream) {
        if (message.type === 'system' && message.subtype === 'init' && typeof message.model === 'string') {
          model = message.model
        }
        if (message.type === 'assistant') {
          for (const block of message.message?.content ?? []) {
            if (block.type === 'tool_use' && typeof block.name === 'string') toolCalls.push(block.name)
            if (block.type === 'text' && typeof block.text === 'string') lastText = block.text
          }
        }
        if (message.type === 'result') result = message as SdkResultMessage
      }
    } catch (err) {
      if (!result) {
        return failure(job.signal.aborted ? 'Stopped: the job ran past its time limit.' : errorText(err), toolCalls, model)
      }
    }

    if (!result) return failure('The agent ended without a result.', toolCalls, model)

    const ok = result.subtype === 'success' && !result.is_error
    const summary = (typeof result.result === 'string' && result.result.trim()) || lastText.trim()
    return {
      ok,
      summary: ok ? oneParagraph(summary) : '',
      model,
      tokensIn: numberOrNull(result.usage?.input_tokens),
      tokensOut: numberOrNull(result.usage?.output_tokens),
      costUsd: numberOrNull(result.total_cost_usd),
      toolCalls: [...new Set(toolCalls)],
      ...(ok ? {} : { error: describeFailure(result.subtype) }),
    }
  }
}

/** Built-in tools a job never gets unless its recipe names them (and recipes can only name file tools). */
export const DISALLOWED_TOOLS = [
  'Bash', 'BashOutput', 'KillShell', 'KillBash', 'WebFetch', 'WebSearch', 'Task', 'Agent',
  'NotebookEdit', 'NotebookRead', 'TodoWrite', 'ExitPlanMode', 'SlashCommand', 'Skill',
  'Edit', 'MultiEdit', 'Write', 'Read', 'Glob', 'Grep', 'LS',
]

/** Permission gate: only the recipe's tools, only inside the job folder, writes only to output/. */
export function checkToolUse(
  job: Pick<JobContext, 'recipe' | 'workDir' | 'outputDir'>,
  toolName: string,
  input: Record<string, unknown>,
): { behavior: 'allow'; updatedInput: Record<string, unknown> } | { behavior: 'deny'; message: string } {
  if (!(job.recipe.tools as string[]).includes(toolName)) {
    return { behavior: 'deny', message: `${toolName} is not allowed in this recipe.` }
  }
  const paths = ['file_path', 'path', 'notebook_path']
    .map((k) => input[k])
    .filter((v): v is string => typeof v === 'string')
  for (const p of paths) {
    if (!isInside(job.workDir, p)) {
      return { behavior: 'deny', message: 'Only files inside this job folder can be used.' }
    }
  }
  // Glob patterns are paths too: no absolute patterns, no climbing out with ..
  const patterns = toolName === 'Glob' ? [input['pattern']] : toolName === 'Grep' ? [input['glob']] : []
  for (const pat of patterns) {
    if (pat === undefined) continue
    if (typeof pat !== 'string' || escapesFolder(pat)) {
      return { behavior: 'deny', message: 'Search patterns must stay inside this job folder.' }
    }
  }
  if (toolName === 'Write' || toolName === 'Edit') {
    for (const p of paths) {
      if (!isInside(job.outputDir, isAbsoluteLike(p) ? p : `${job.workDir}/${p}`)) {
        return { behavior: 'deny', message: 'Results can only be written to the output folder.' }
      }
    }
  }
  return { behavior: 'allow', updatedInput: input }
}

function escapesFolder(pattern: string): boolean {
  // Any ".." at all (also inside braces like {..,x}) is refused.
  return isAbsoluteLike(pattern) || pattern.startsWith('~') || /[{,]\s*([\\/~]|[A-Za-z]:)/.test(pattern) || pattern.includes('..')
}

function isAbsoluteLike(p: string): boolean {
  return p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p)
}

function failure(error: string, toolCalls: string[] = [], model: string | null = null): ExecResult {
  return { ok: false, summary: '', model, tokensIn: null, tokensOut: null, costUsd: null, toolCalls, error }
}

function describeFailure(subtype: string | undefined): string {
  switch (subtype) {
    case 'error_max_turns': return 'Stopped: the job took too many steps.'
    case 'error_max_budget_usd': return 'Stopped: the job hit its cost limit.'
    case 'error_during_execution': return 'The agent hit an error while working.'
    default: return 'The job did not finish.'
  }
}

function oneParagraph(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 600)
}

function numberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Minimal structural types for the parts of the SDK we use, so this package
// compiles without the SDK installed.
interface SdkResultMessage {
  type: 'result'
  subtype?: string
  is_error?: boolean
  result?: unknown
  total_cost_usd?: number
  usage?: { input_tokens?: number; output_tokens?: number }
}
interface SdkMessage {
  type: string
  subtype?: string
  model?: unknown
  message?: { content?: Array<{ type: string; name?: unknown; text?: unknown }> }
}
interface ClaudeAgentSdk {
  query(args: { prompt: string; options: Record<string, unknown> }): AsyncIterable<SdkMessage>
}
