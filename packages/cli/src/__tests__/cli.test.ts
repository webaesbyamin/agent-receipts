import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import {
  ReceiptStore,
  KeyManager,
  ConfigManager,
  ReceiptEngine,
} from '@agentreceipts/mcp-server'

const exec = promisify(execFile)

// Path to the built CLI — we use tsx to run the source directly in tests
const CLI_SRC = join(__dirname, '..', 'index.ts')

function runCLI(args: string[], env?: Record<string, string>) {
  return exec('npx', ['tsx', CLI_SRC, ...args], {
    env: { ...process.env, ...env },
    cwd: join(__dirname, '..', '..'),
  })
}

describe('CLI', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('shows help with --help', async () => {
    const { stdout } = await runCLI(['--help'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('agent-receipts')
    expect(stdout).toContain('Commands:')
    expect(stdout).toContain('init')
    expect(stdout).toContain('verify')
  })

  it('shows version with --version', async () => {
    const { stdout } = await runCLI(['--version'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout.trim()).toBe('0.1.0')
  })

  it('init creates data directory and keys', async () => {
    const { stdout } = await runCLI(['init'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('Initialized')
    expect(stdout).toContain('Public key:')
  })

  it('keys shows public key', async () => {
    const { stdout } = await runCLI(['keys'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('Public key:')
  })

  it('keys --export outputs JSON', async () => {
    const { stdout } = await runCLI(['keys', '--export'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    const json = JSON.parse(stdout)
    expect(json.algorithm).toBe('Ed25519')
    expect(json.public_key).toMatch(/^[a-f0-9]{64}$/)
  })

  it('list shows receipts', async () => {
    // Create a receipt first via the engine
    const store = new ReceiptStore(tmpDir)
    await store.init()
    const km = new KeyManager(tmpDir)
    await km.init()
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    const engine = new ReceiptEngine(store, km, cm)
    await engine.track({ action: 'test_list', input: 'data' })

    const { stdout } = await runCLI(['list'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('test_list')
  })

  it('list --json outputs JSON', async () => {
    const store = new ReceiptStore(tmpDir)
    await store.init()
    const km = new KeyManager(tmpDir)
    await km.init()
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    const engine = new ReceiptEngine(store, km, cm)
    await engine.track({ action: 'json_list', input: 'data' })

    const { stdout } = await runCLI(['list', '--json'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    const result = JSON.parse(stdout)
    expect(result.data.length).toBe(1)
    expect(result.data[0].action).toBe('json_list')
  })

  it('inspect shows receipt details', async () => {
    const store = new ReceiptStore(tmpDir)
    await store.init()
    const km = new KeyManager(tmpDir)
    await km.init()
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    const engine = new ReceiptEngine(store, km, cm)
    const receipt = await engine.track({ action: 'inspect_test', input: 'data' })

    const { stdout } = await runCLI(['inspect', receipt.receipt_id], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain(receipt.receipt_id)
    expect(stdout).toContain('inspect_test')
  })

  it('verify confirms valid receipt', async () => {
    const store = new ReceiptStore(tmpDir)
    await store.init()
    const km = new KeyManager(tmpDir)
    await km.init()
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    const engine = new ReceiptEngine(store, km, cm)
    const receipt = await engine.track({ action: 'verify_cli', input: 'data' })

    const { stdout } = await runCLI(['verify', receipt.receipt_id], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('Verified')
  })

  it('stats shows aggregate counts', async () => {
    const store = new ReceiptStore(tmpDir)
    await store.init()
    const km = new KeyManager(tmpDir)
    await km.init()
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    const engine = new ReceiptEngine(store, km, cm)
    await engine.track({ action: 'a', input: '1' })
    await engine.track({ action: 'b', input: '2' })

    const { stdout } = await runCLI(['stats'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('Total receipts: 2')
    expect(stdout).toContain('By status:')
    expect(stdout).toContain('completed')
  })

  it('export outputs receipt JSON', async () => {
    const store = new ReceiptStore(tmpDir)
    await store.init()
    const km = new KeyManager(tmpDir)
    await km.init()
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    const engine = new ReceiptEngine(store, km, cm)
    const receipt = await engine.track({ action: 'export_test', input: 'data' })

    const { stdout } = await runCLI(['export', receipt.receipt_id], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    const exported = JSON.parse(stdout)
    expect(exported.receipt_id).toBe(receipt.receipt_id)
  })
})
