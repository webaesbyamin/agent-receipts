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

  it('inspect shows constraint results when present', async () => {
    const { engine } = await setupEngine(tmpDir)
    const receipt = await engine.track({
      action: 'constrained_inspect',
      input: 'data',
      latency_ms: 2000,
      constraints: [{ type: 'max_latency_ms', value: 5000 }],
    })

    const { stdout } = await runCLI(['inspect', receipt.receipt_id], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('Constraints:')
    expect(stdout).toContain('1/1 PASSED')
    expect(stdout).toContain('max_latency_ms')
  })

  it('inspect shows no constraints section when absent', async () => {
    const { engine } = await setupEngine(tmpDir)
    const receipt = await engine.track({
      action: 'no_constraints',
      input: 'data',
    })

    const { stdout } = await runCLI(['inspect', receipt.receipt_id], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).not.toContain('Constraints:')
  })

  it('list --failed filters correctly', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({
      action: 'pass_action',
      input: 'data',
      latency_ms: 1000,
      constraints: [{ type: 'max_latency_ms', value: 5000 }],
    })
    await engine.track({
      action: 'fail_action',
      input: 'data',
      latency_ms: 8000,
      constraints: [{ type: 'max_latency_ms', value: 5000 }],
    })

    const { stdout } = await runCLI(['list', '--failed'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('fail_action')
    expect(stdout).not.toContain('pass_action')
  })

  it('list --passed filters correctly', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({
      action: 'pass_action',
      input: 'data',
      latency_ms: 1000,
      constraints: [{ type: 'max_latency_ms', value: 5000 }],
    })
    await engine.track({
      action: 'fail_action',
      input: 'data',
      latency_ms: 8000,
      constraints: [{ type: 'max_latency_ms', value: 5000 }],
    })

    const { stdout } = await runCLI(['list', '--passed'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('pass_action')
    expect(stdout).not.toContain('fail_action')
  })

  it('stats includes constraint counts', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({
      action: 'pass_action',
      input: 'data',
      latency_ms: 1000,
      constraints: [{ type: 'max_latency_ms', value: 5000 }],
    })
    await engine.track({
      action: 'fail_action',
      input: 'data',
      latency_ms: 8000,
      constraints: [{ type: 'max_latency_ms', value: 5000 }],
    })

    const { stdout } = await runCLI(['stats'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('Constraints:')
    expect(stdout).toContain('passed: 1')
    expect(stdout).toContain('failed: 1')
  })

  // === Phase 5 tests ===

  it('judgments shows "no judgments" when none exist', async () => {
    const { engine } = await setupEngine(tmpDir)
    const receipt = await engine.track({ action: 'no_judges', input: 'data' })

    const { stdout } = await runCLI(['judgments', receipt.receipt_id], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('No judgments found')
  })

  it('judgments command shows judgment details', async () => {
    const { engine } = await setupEngine(tmpDir)
    const { hashData } = await import('@agent-receipts/mcp-server')

    const parent = await engine.track({
      action: 'judged_action',
      input: 'data',
      output: 'result',
    })

    // Create and complete a judgment receipt
    const pending = await engine.create({
      receipt_type: 'judgment',
      action: 'judge',
      input_hash: hashData({ receipt_id: parent.receipt_id }),
      parent_receipt_id: parent.receipt_id,
      chain_id: parent.chain_id,
      status: 'pending',
      metadata: { rubric_version: '1.0' },
    })

    await engine.complete(pending.receipt_id, {
      status: 'completed',
      output_hash: hashData({ verdict: 'pass' }),
      output_summary: 'PASS (0.91)',
      confidence: 0.88,
      metadata: {
        rubric_version: '1.0',
        judgment: {
          verdict: 'pass',
          score: 0.91,
          criteria_results: [
            { criterion: 'accuracy', score: 0.95, passed: true, reasoning: 'Correct output' },
          ],
          overall_reasoning: 'Good quality output.',
          rubric_version: '1.0',
        },
      },
    })

    const { stdout } = await runCLI(['judgments', parent.receipt_id], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('1 found')
    expect(stdout).toContain('PASS')
    expect(stdout).toContain('accuracy')
  })

  it('judgments --json outputs JSON', async () => {
    const { engine } = await setupEngine(tmpDir)
    const receipt = await engine.track({ action: 'json_judge', input: 'data' })

    const { stdout } = await runCLI(['judgments', receipt.receipt_id, '--json'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    const result = JSON.parse(stdout)
    expect(result.receipt_id).toBe(receipt.receipt_id)
    expect(result.count).toBe(0)
    expect(result.judgments).toEqual([])
  })

  it('cleanup deletes expired receipts', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({
      action: 'expired',
      input: 'data',
      expires_at: '2020-01-01T00:00:00.000Z',
    })
    await engine.track({
      action: 'fresh',
      input: 'data',
    })

    const { stdout } = await runCLI(['cleanup'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('Deleted 1')
    expect(stdout).toContain('1 remaining')
  })

  it('cleanup --dry-run shows without deleting', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({
      action: 'expired_action',
      input: 'data',
      expires_at: '2020-01-01T00:00:00.000Z',
    })

    const { stdout } = await runCLI(['cleanup', '--dry-run'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('Expired: 1')
    expect(stdout).toContain('dry run')

    // Verify receipt still exists
    const list = await engine.list()
    expect(list.data.length).toBe(1)
  })

  it('inspect shows expires_at when present', async () => {
    const { engine } = await setupEngine(tmpDir)
    const receipt = await engine.track({
      action: 'expiring_receipt',
      input: 'data',
      expires_at: '2099-12-31T23:59:59.000Z',
    })

    const { stdout } = await runCLI(['inspect', receipt.receipt_id], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('Expires:')
    expect(stdout).toContain('2099-12-31')
    expect(stdout).toContain('remaining')
  })

  it('inspect shows EXPIRED for past dates', async () => {
    const { engine } = await setupEngine(tmpDir)
    const receipt = await engine.track({
      action: 'already_expired',
      input: 'data',
      expires_at: '2020-01-01T00:00:00.000Z',
    })

    const { stdout } = await runCLI(['inspect', receipt.receipt_id], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('Expires:')
    expect(stdout).toContain('EXPIRED')
  })

  // === Phase 7: Invoice tests ===

  it('invoice requires --from and --to', async () => {
    await setupEngine(tmpDir)
    try {
      await runCLI(['invoice'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
      expect.unreachable('Should have thrown')
    } catch (err: unknown) {
      const error = err as { stderr: string }
      expect(error.stderr).toContain('Usage:')
    }
  })

  it('invoice --format json outputs JSON to stdout', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({ action: 'inv_test', input: 'data', cost_usd: 0.01 })

    const { stdout } = await runCLI(
      ['invoice', '--from', '2000-01-01', '--to', '2099-12-31', '--format', 'json'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    const parsed = JSON.parse(stdout)
    expect(parsed.invoice_number).toMatch(/^AR-/)
    expect(parsed.summary.total_receipts).toBe(1)
  })

  it('invoice --format csv outputs CSV to stdout', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({ action: 'csv_test', input: 'data', cost_usd: 0.005 })

    const { stdout } = await runCLI(
      ['invoice', '--from', '2000-01-01', '--to', '2099-12-31', '--format', 'csv'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    expect(stdout).toContain('receipt_id')
    expect(stdout).toContain('csv_test')
    expect(stdout).toContain('# Invoice:')
  })

  it('invoice --format md outputs Markdown to stdout', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({ action: 'md_test', input: 'data', cost_usd: 0.002 })

    const { stdout } = await runCLI(
      ['invoice', '--from', '2000-01-01', '--to', '2099-12-31', '--format', 'md'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    expect(stdout).toContain('# Invoice AR-')
    expect(stdout).toContain('md_test')
    expect(stdout).toContain('## Summary')
  })

  it('invoice --format html writes file and prints summary', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({ action: 'html_test', input: 'data', cost_usd: 0.001 })

    const { stdout } = await runCLI(
      ['invoice', '--from', '2000-01-01', '--to', '2099-12-31', '--format', 'html', '--output', join(tmpDir, 'test.html')],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    expect(stdout).toContain('Invoice AR-')
    expect(stdout).toContain('Receipts: 1')
    expect(stdout).toContain('File:')
  })

  it('invoice with --group-by and --agent filters', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({ action: 'alpha', input: '1', cost_usd: 0.01 })
    await engine.track({ action: 'beta', input: '2', cost_usd: 0.02 })

    const { stdout } = await runCLI(
      ['invoice', '--from', '2000-01-01', '--to', '2099-12-31', '--format', 'json', '--group-by', 'action'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    const parsed = JSON.parse(stdout)
    expect(parsed.groups.length).toBe(2)
  })

  it('invoice with --client and --provider', async () => {
    const { engine } = await setupEngine(tmpDir)
    await engine.track({ action: 'test', input: 'data', cost_usd: 0.001 })

    const { stdout } = await runCLI(
      ['invoice', '--from', '2000-01-01', '--to', '2099-12-31', '--format', 'json', '--client', 'Acme Corp', '--provider', 'AI Agency'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    const parsed = JSON.parse(stdout)
    expect(parsed.client.name).toBe('Acme Corp')
    expect(parsed.provider.name).toBe('AI Agency')
  })

  it('invoice with no matching receipts returns empty', async () => {
    await setupEngine(tmpDir)

    const { stdout } = await runCLI(
      ['invoice', '--from', '2090-01-01', '--to', '2090-12-31', '--format', 'json'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    const parsed = JSON.parse(stdout)
    expect(parsed.summary.total_receipts).toBe(0)
  })

  // === Seed tests ===

  it('seed --demo generates receipts', async () => {
    await setupEngine(tmpDir)

    const { stdout } = await runCLI(
      ['seed', '--demo'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    expect(stdout).toContain('Seeded')
    expect(stdout).toContain('receipts')
    expect(stdout).toContain('Chains:')
    expect(stdout).toContain('Judgments:')
  }, 30000)

  it('seed --count 10 respects custom count', async () => {
    await setupEngine(tmpDir)

    const { stdout } = await runCLI(
      ['seed', '--demo', '--count', '10'],
      { AGENT_RECEIPTS_DATA_DIR: tmpDir },
    )
    expect(stdout).toContain('Seeded')
    expect(stdout).toContain('receipts')
  }, 30000)

  // === Watch test ===

  it('watch appears in help output', async () => {
    const { stdout } = await runCLI(['--help'], { AGENT_RECEIPTS_DATA_DIR: tmpDir })
    expect(stdout).toContain('watch')
  })
})
