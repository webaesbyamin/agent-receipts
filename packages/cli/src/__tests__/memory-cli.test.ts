import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const CLI_SRC = join(__dirname, '..', 'index.ts')

function runCLI(args: string[], env?: Record<string, string>) {
  return exec('npx', ['tsx', CLI_SRC, ...args], {
    env: { ...process.env, ...env },
    cwd: join(__dirname, '..', '..'),
  })
}

describe('CLI Memory Commands', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cli-memory-'))
    await runCLI(['init'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('memory observe stores an observation', async () => {
    const { stdout } = await runCLI(
      ['memory', 'observe', 'Alice', 'person', 'Works at Acme'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir }
    )
    expect(stdout).toContain('Observed:')
    expect(stdout).toContain('Alice')
    expect(stdout).toContain('Receipt:')
  })

  it('memory entities lists entities', async () => {
    await runCLI(
      ['memory', 'observe', 'Bob', 'person', 'Is a developer'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir }
    )
    const { stdout } = await runCLI(
      ['memory', 'entities'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir }
    )
    expect(stdout).toContain('Bob')
    expect(stdout).toContain('person')
  })

  it('memory recall searches memories', async () => {
    await runCLI(
      ['memory', 'observe', 'Carol', 'person', 'Expert in Python'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir }
    )
    const { stdout } = await runCLI(
      ['memory', 'recall', 'Python'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir }
    )
    expect(stdout).toContain('Carol')
  })

  it('memory audit shows report', async () => {
    await runCLI(
      ['memory', 'observe', 'Dave', 'project', 'A project'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir }
    )
    const { stdout } = await runCLI(
      ['memory', 'audit'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir }
    )
    expect(stdout).toContain('Memory Audit Report')
    expect(stdout).toContain('Entities: 1')
  })

  it('memory export produces JSON', async () => {
    await runCLI(
      ['memory', 'observe', 'Eve', 'person', 'Test export'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir }
    )
    const { stdout } = await runCLI(
      ['memory', 'export'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir }
    )
    const data = JSON.parse(stdout)
    expect(data).toHaveLength(1)
    expect(data[0].entity.name).toBe('Eve')
  })
})
