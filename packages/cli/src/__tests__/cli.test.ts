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
} from '@agent-receipts/mcp-server'
import { generateKeyPair } from '@agent-receipts/crypto'

const exec = promisify(execFile)

// Path to the built CLI — we use tsx to run the source directly in tests
const CLI_SRC = join(__dirname, '..', 'index.ts')

function runCLI(args: string[], env?: Record<string, string>) {
  return exec('npx', ['tsx', CLI_SRC, ...args], {
    env: { ...process.env, ...env },
    cwd: join(__dirname, '..', '..'),
  })
}

async function setupEngine(tmpDir: string) {
  const store = new ReceiptStore(tmpDir)
  await store.init()
  const km = new KeyManager(tmpDir)
  await km.init()
  const cm = new ConfigManager(tmpDir)
  await cm.init()
  const engine = new ReceiptEngine(store, km, cm)
  return { store, km, cm, engine }
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
    const { engine } = await setupEngine(tmpDir)
    await engine.track({ action: 'test_list', input: 'data' })

    const { stdout } = await runCLI(['list'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('test_list')
  })

  it('list --json outputs JSON', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({ action: 'json_list', input: 'data' })

    const { stdout } = await runCLI(['list', '--json'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    const result = JSON.parse(stdout)
    expect(result.data.length).toBe(1)
    expect(result.data[0].action).toBe('json_list')
  })

  it('inspect shows receipt details', async () => {
    const { engine } = await setupEngine(tmpDir)
    const receipt = await engine.track({ action: 'inspect_test', input: 'data' })

    const { stdout } = await runCLI(['inspect', receipt.receipt_id], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain(receipt.receipt_id)
    expect(stdout).toContain('inspect_test')
  })

  it('verify confirms valid receipt', async () => {
    const { engine } = await setupEngine(tmpDir)
    const receipt = await engine.track({ action: 'verify_cli', input: 'data' })

    const { stdout } = await runCLI(['verify', receipt.receipt_id], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('Verified')
  })

  it('stats shows aggregate counts', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({ action: 'a', input: '1' })
    await engine.track({ action: 'b', input: '2' })

    const { stdout } = await runCLI(['stats'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('Total receipts: 2')
    expect(stdout).toContain('By status:')
    expect(stdout).toContain('completed')
  })

  it('export outputs receipt JSON', async () => {
    const { engine } = await setupEngine(tmpDir)
    const receipt = await engine.track({ action: 'export_test', input: 'data' })

    const { stdout } = await runCLI(['export', receipt.receipt_id], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    const exported = JSON.parse(stdout)
    expect(exported.receipt_id).toBe(receipt.receipt_id)
  })

  // === New tests ===

  it('keys --import imports valid key and derives correct public key', async () => {
    const keyPair = generateKeyPair()
    const { stdout } = await runCLI(
      ['keys', '--import', keyPair.privateKey],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    expect(stdout).toContain('Keys imported successfully')
    expect(stdout).toContain(`Public key: ${keyPair.publicKey}`)
  })

  it('keys --import rejects wrong length key', async () => {
    try {
      await runCLI(
        ['keys', '--import', 'abcdef1234567890'],
        { AGENT_RECEIPTS_DATA_DIR: tmpDir },
      )
      expect.unreachable('Should have thrown')
    } catch (err: unknown) {
      const error = err as { stderr: string }
      expect(error.stderr).toContain('Invalid key: must be 64 hex characters')
    }
  })

  it('keys --import rejects non-hex characters', async () => {
    try {
      await runCLI(
        ['keys', '--import', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'],
        { AGENT_RECEIPTS_DATA_DIR: tmpDir },
      )
      expect.unreachable('Should have thrown')
    } catch (err: unknown) {
      const error = err as { stderr: string }
      expect(error.stderr).toContain('Invalid key: must be 64 hex characters')
    }
  })

  it('verify --key verifies receipt with external public key', async () => {
    const { engine, km } = await setupEngine(tmpDir)
    const receipt = await engine.track({ action: 'verify_ext', input: 'data' })
    const publicKey = km.getPublicKey()

    const { stdout } = await runCLI(
      ['verify', receipt.receipt_id, '--key', publicKey],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    expect(stdout).toContain('Verified')
    expect(stdout).toContain(`Public key: ${publicKey}`)
  })

  it('verify --key detects invalid key', async () => {
    const { engine } = await setupEngine(tmpDir)
    const receipt = await engine.track({ action: 'verify_bad', input: 'data' })

    // Use a different valid key that won't match the signature
    const otherKeyPair = generateKeyPair()
    try {
      await runCLI(
        ['verify', receipt.receipt_id, '--key', otherKeyPair.publicKey],
        { AGENT_RECEIPTS_DATA_DIR: tmpDir },
      )
      expect.unreachable('Should have thrown')
    } catch (err: unknown) {
      const error = err as { stderr: string }
      expect(error.stderr).toContain('FAILED')
    }
  })

  it('verify reads receipt from JSON file on disk', async () => {
    const { engine, km } = await setupEngine(tmpDir)
    const receipt = await engine.track({ action: 'verify_file', input: 'data' })
    const filePath = join(tmpDir, 'receipt.json')
    await writeFile(filePath, JSON.stringify(receipt), 'utf-8')

    const { stdout } = await runCLI(
      ['verify', filePath],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    expect(stdout).toContain('Verified')
    expect(stdout).toContain(receipt.receipt_id)
  })

  it('chain --tree displays tree with formatting', async () => {
    const { engine } = await setupEngine(tmpDir)
    const r1 = await engine.track({ action: 'step_one', input: 'start' })
    const r2 = await engine.track({
      action: 'step_two',
      input: 'middle',
      chain_id: r1.chain_id,
      parent_receipt_id: r1.receipt_id,
    })

    const { stdout } = await runCLI(
      ['chain', r1.chain_id, '--tree'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    expect(stdout).toContain('Chain:')
    expect(stdout).toContain('└─')
    expect(stdout).toContain('step_one')
    expect(stdout).toContain('step_two')
  })

  it('chain --tree handles single-receipt chain', async () => {
    const { engine } = await setupEngine(tmpDir)
    const r1 = await engine.track({ action: 'solo_action', input: 'only' })

    const { stdout } = await runCLI(
      ['chain', r1.chain_id, '--tree'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    expect(stdout).toContain('1 receipts')
    expect(stdout).toContain('└─')
    expect(stdout).toContain('solo_action')
  })

  it('export --all outputs JSON array', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({ action: 'exp1', input: '1' })
    await engine.track({ action: 'exp2', input: '2' })

    const { stdout } = await runCLI(
      ['export', '--all'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    const arr = JSON.parse(stdout)
    expect(Array.isArray(arr)).toBe(true)
    expect(arr.length).toBe(2)
  })

  it('export --all outputs empty array when no receipts', async () => {
    // Init engine to create data dir and keys
    await setupEngine(tmpDir)

    const { stdout } = await runCLI(
      ['export', '--all'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    const arr = JSON.parse(stdout)
    expect(Array.isArray(arr)).toBe(true)
    expect(arr.length).toBe(0)
  })

  it('export --all --pretty outputs indented JSON', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({ action: 'pretty_test', input: 'data' })

    const { stdout } = await runCLI(
      ['export', '--all', '--pretty'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    // Pretty-printed JSON has newlines and indentation
    expect(stdout).toContain('  ')
    expect(stdout).toContain('\n')
    const arr = JSON.parse(stdout)
    expect(Array.isArray(arr)).toBe(true)
    expect(arr[0].action).toBe('pretty_test')
  })
})
