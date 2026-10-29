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
