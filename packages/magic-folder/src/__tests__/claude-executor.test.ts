import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { checkToolUse, ClaudeExecutor } from '../claude-executor.js'
import { buildPrompt, isInside } from '../executor.js'
import { parseRecipe } from '../recipe.js'

const workDir = '/tmp/mf/.magic/jobs/2026-10-28 1200 sofa'
const job = {
  recipe: parseRecipe('Write product descriptions', '---\ntools: Read, Write\n---\nDescribe it.'),
  workDir,
  outputDir: join(workDir, 'output'),
}

describe('checkToolUse (the agent stays inside its job folder)', () => {
  it('allows reading inputs and writing outputs', () => {
    expect(checkToolUse(job, 'Read', { file_path: join(workDir, 'input', 'sofa.jpg') }).behavior).toBe('allow')
    expect(checkToolUse(job, 'Write', { file_path: join(workDir, 'output', 'sofa.md'), content: 'x' }).behavior).toBe('allow')
    expect(checkToolUse(job, 'Write', { file_path: 'output/sofa.md', content: 'x' }).behavior).toBe('allow')
  })

  it('denies tools the recipe does not grant', () => {
    expect(checkToolUse(job, 'Bash', { command: 'ls' }).behavior).toBe('deny')
    expect(checkToolUse(job, 'Edit', { file_path: join(workDir, 'output', 'a.md') }).behavior).toBe('deny')
    expect(checkToolUse(job, 'WebFetch', { url: 'https://x' }).behavior).toBe('deny')
  })

  it('denies paths outside the job folder, including ../ escapes', () => {
    expect(checkToolUse(job, 'Read', { file_path: '/etc/passwd' }).behavior).toBe('deny')
    expect(checkToolUse(job, 'Read', { file_path: join(workDir, '..', 'other-job', 'input', 'x') }).behavior).toBe('deny')
    expect(checkToolUse(job, 'Read', { file_path: '../../../Done/secret.txt' }).behavior).toBe('deny')
  })

  it('denies writing anywhere except output/ (inputs are read-only)', () => {
    expect(checkToolUse(job, 'Write', { file_path: join(workDir, 'input', 'sofa.jpg'), content: '' }).behavior).toBe('deny')
    expect(checkToolUse(job, 'Write', { file_path: 'input/sofa.jpg', content: '' }).behavior).toBe('deny')
    expect(checkToolUse(job, 'Write', { file_path: join(workDir, 'notes.md'), content: '' }).behavior).toBe('deny')
  })
})

describe('isInside', () => {
  it('handles prefixes that only look alike', () => {
    expect(isInside('/a/job', '/a/job/x')).toBe(true)
    expect(isInside('/a/job', '/a/job2/x')).toBe(false)
    expect(isInside('/a/job', '/a/job')).toBe(true)
  })
})

describe('buildPrompt', () => {
  it('includes the instruction, inputs, note and the output rule', () => {
    const p = buildPrompt({
      jobId: 'j', recipe: job.recipe, workDir, inputDir: join(workDir, 'input'), outputDir: job.outputDir,
      inputFiles: ['sofa.jpg'], note: 'Make it short', signal: new AbortController().signal,
    })
    expect(p).toContain('Describe it.')
    expect(p).toContain('- sofa.jpg')
    expect(p).toContain('Make it short')
    expect(p).toContain(job.outputDir)
  })
})

describe('ClaudeExecutor without the SDK or key', () => {
  it('fails clearly instead of crashing', async () => {
    const saved = process.env['ANTHROPIC_API_KEY']
    delete process.env['ANTHROPIC_API_KEY']
    const r = await new ClaudeExecutor().run({
      jobId: 'j', recipe: job.recipe, workDir, inputDir: join(workDir, 'input'), outputDir: job.outputDir,
      inputFiles: [], note: null, signal: new AbortController().signal,
    })
    if (saved !== undefined) process.env['ANTHROPIC_API_KEY'] = saved
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/Claude Agent SDK is not installed|ANTHROPIC_API_KEY/)
  })
})

describe('sandbox details', () => {
  it('denies a symlink inside the job folder that points outside it', async () => {
    const { mkdtemp, mkdir, symlink, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const dir = await mkdtemp(join(tmpdir(), 'mf-link-'))
    try {
      await mkdir(join(dir, 'input'), { recursive: true })
      await mkdir(join(dir, 'output'), { recursive: true })
      await symlink('/etc', join(dir, 'input', 'sneaky'))
      const j = { ...job, workDir: dir, outputDir: join(dir, 'output') }
      expect(checkToolUse(j, 'Read', { file_path: join(dir, 'input', 'sneaky', 'passwd') }).behavior).toBe('deny')
      await symlink(dir.replace(/[^/]+$/, ''), join(dir, 'output', 'up'))
      expect(checkToolUse(j, 'Write', { file_path: join(dir, 'output', 'up', 'x.md') }).behavior).toBe('deny')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('denies a dangling symlink that would write outside', async () => {
    const { mkdtemp, mkdir, symlink, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const dir = await mkdtemp(join(tmpdir(), 'mf-dangle-'))
    try {
      await mkdir(join(dir, 'output'), { recursive: true })
      await symlink(join(tmpdir(), 'mf-does-not-exist-' + Date.now()), join(dir, 'output', 'link'))
      const j = { ...job, workDir: dir, outputDir: join(dir, 'output') }
      expect(checkToolUse(j, 'Write', { file_path: join(dir, 'output', 'link') }).behavior).toBe('deny')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('denies Glob and Grep patterns that climb out or are absolute', () => {
    const g = { ...job, recipe: parseRecipe('Search', '---\ntools: Read, Glob, Grep\n---\nFind.') }
    expect(checkToolUse(g, 'Glob', { pattern: '**/*.md' }).behavior).toBe('allow')
    expect(checkToolUse(g, 'Glob', { pattern: '/home/**/*.pem' }).behavior).toBe('deny')
    expect(checkToolUse(g, 'Glob', { pattern: '../../../**' }).behavior).toBe('deny')
    expect(checkToolUse(g, 'Glob', { pattern: 'input/../../x' }).behavior).toBe('deny')
    expect(checkToolUse(g, 'Glob', { pattern: '~/.ssh/*' }).behavior).toBe('deny')
    expect(checkToolUse(g, 'Grep', { pattern: 'secret', glob: '../../**' }).behavior).toBe('deny')
    expect(checkToolUse(g, 'Grep', { pattern: 'secret', path: '/' }).behavior).toBe('deny')
    expect(checkToolUse(g, 'Grep', { pattern: 'price', glob: '*.csv' }).behavior).toBe('allow')
    expect(checkToolUse(g, 'Glob', { pattern: '{..,x}/{..,x}/**' }).behavior).toBe('deny')
    expect(checkToolUse(g, 'Glob', { pattern: '**/{..}/**' }).behavior).toBe('deny')
    expect(checkToolUse(g, 'Glob', { pattern: '{x,/etc}/*' }).behavior).toBe('deny')
    expect(checkToolUse(g, 'Glob', { pattern: '{input,output}/*.md' }).behavior).toBe('allow')
  })
})

describe('ClaudeExecutor with an SDK', () => {
  const ctx = (signal = new AbortController().signal) => ({
    jobId: 'j', recipe: job.recipe, workDir, inputDir: join(workDir, 'input'), outputDir: job.outputDir,
    inputFiles: ['sofa.jpg'], note: null, signal,
  })

  function fakeSdk(messages: unknown[], capture: { options?: Record<string, unknown> }) {
    return async () => ({
      query: ({ options }: { options: Record<string, unknown> }) => {
        capture.options = options
        return (async function* () { for (const m of messages) yield m })()
      },
    })
  }

  it('fences tools with a PreToolUse hook and pre-approves nothing', async () => {
    process.env['ANTHROPIC_API_KEY'] = process.env['ANTHROPIC_API_KEY'] ?? 'test'
    const capture: { options?: Record<string, unknown> } = {}
    await new ClaudeExecutor({ loadSdk: fakeSdk([{ type: 'result', subtype: 'success', is_error: false, result: 'ok' }], capture) }).run(ctx())
    const o = capture.options!
    expect(o['allowedTools']).toBeUndefined()
    expect(o['settingSources']).toEqual([])
    expect(o['cwd']).toBe(workDir)
    expect(o['maxBudgetUsd']).toBe(job.recipe.maxCostUsd)
    const disallowed = o['disallowedTools'] as string[]
    expect(disallowed).toContain('Bash')
    expect(disallowed).toContain('WebFetch')
    expect(disallowed).not.toContain('Read')
    expect(disallowed).not.toContain('Write')
    const hooks = o['hooks'] as { PreToolUse: Array<{ hooks: Array<(i: unknown) => Promise<Record<string, unknown>>> }> }
    const gate = hooks.PreToolUse[0]!.hooks[0]!
    const denied = await gate({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: '/etc/passwd' } })
    expect(denied).toEqual({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'Only files inside this job folder can be used.' } })
    expect(await gate({ tool_name: 'Bash', tool_input: { command: 'ls' } })).toHaveProperty('hookSpecificOutput')
    expect(await gate({ tool_name: 'Read', tool_input: { file_path: join(workDir, 'input', 'sofa.jpg') } })).toEqual({})
  })

  it('maps the result message: model, tokens, estimated cost, tools, summary', async () => {
    process.env['ANTHROPIC_API_KEY'] = process.env['ANTHROPIC_API_KEY'] ?? 'test'
    const r = await new ClaudeExecutor({
      loadSdk: fakeSdk([
        { type: 'system', subtype: 'init', model: 'claude-x' },
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read' }, { type: 'tool_use', name: 'Write' }, { type: 'tool_use', name: 'Read' }] } },
        { type: 'result', subtype: 'success', is_error: false, result: 'Wrote   one\ndescription.', total_cost_usd: 0.031, usage: { input_tokens: 900, output_tokens: 120 } },
      ], {}),
    }).run(ctx())
    expect(r).toEqual({ ok: true, summary: 'Wrote one description.', model: 'claude-x', tokensIn: 900, tokensOut: 120, costUsd: 0.031, toolCalls: ['Read', 'Write'] })
  })

  it('turns SDK error results into plain reasons', async () => {
    process.env['ANTHROPIC_API_KEY'] = process.env['ANTHROPIC_API_KEY'] ?? 'test'
    const run = (subtype: string) => new ClaudeExecutor({ loadSdk: fakeSdk([{ type: 'result', subtype, is_error: true, total_cost_usd: 0.5 }], {}) }).run(ctx())
    expect((await run('error_max_budget_usd')).error).toBe('Stopped: the job hit its cost limit.')
    expect((await run('error_max_turns')).error).toBe('Stopped: the job took too many steps.')
    const r = await run('error_during_execution')
    expect(r.ok).toBe(false)
    expect(r.costUsd).toBe(0.5)
  })
})
