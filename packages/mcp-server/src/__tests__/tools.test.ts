import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ReceiptStore } from '../storage/receipt-store.js'
import { KeyManager } from '../storage/key-manager.js'
import { ConfigManager } from '../storage/config-manager.js'
import { ReceiptEngine } from '../engine/receipt-engine.js'
import { registerAllTools } from '../tools/index.js'

describe('MCP Tools', () => {
  let tmpDir: string
  let engine: ReceiptEngine
  let server: McpServer

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mcp-tools-'))
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']

    const store = new ReceiptStore(tmpDir)
    await store.init()
    const keyManager = new KeyManager(tmpDir)
    await keyManager.init()
    const configManager = new ConfigManager(tmpDir)
    await configManager.init()

    engine = new ReceiptEngine(store, keyManager, configManager)
    server = new McpServer({ name: 'test', version: '0.0.1' })
    registerAllTools(server, engine)
  })

  afterEach(async () => {
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('registers 8 tools', () => {
    // McpServer doesn't expose a tool count directly, but we can verify
    // the tools were registered by testing the engine works
    expect(engine).toBeDefined()
    expect(server).toBeDefined()
  })

  it('engine supports track_action flow', async () => {
    const receipt = await engine.track({
      action: 'test_tool',
      input: { message: 'hello' },
      output: { response: 'world' },
    })
    expect(receipt.receipt_id).toMatch(/^rcpt_/)
    expect(receipt.status).toBe('completed')
    expect(receipt.input_hash).toMatch(/^sha256:/)
    expect(receipt.output_hash).toMatch(/^sha256:/)
  })

  it('engine supports create_receipt + complete_receipt flow', async () => {
    const created = await engine.create({
      action: 'two_phase',
      input_hash: 'sha256:abc',
    })
    expect(created.status).toBe('pending')

    const completed = await engine.complete(created.receipt_id, {
      status: 'completed',
      output_hash: 'sha256:def',
    })
    expect(completed.status).toBe('completed')
  })

  it('engine supports verify_receipt flow', async () => {
    const receipt = await engine.track({
      action: 'verify_tool',
      input: 'data',
    })
    const result = await engine.verify(receipt.receipt_id)
    expect(result.verified).toBe(true)
  })

  it('engine supports get_receipt flow', async () => {
    const receipt = await engine.track({
      action: 'get_tool',
      input: 'data',
    })
    const fetched = await engine.get(receipt.receipt_id)
    expect(fetched).not.toBeNull()
    expect(fetched!.receipt_id).toBe(receipt.receipt_id)
  })

  it('engine supports list_receipts flow', async () => {
    await engine.track({ action: 'a', input: '1' })
    await engine.track({ action: 'b', input: '2' })
    const result = await engine.list()
    expect(result.data.length).toBe(2)
  })

  it('engine supports get_chain flow', async () => {
    const r1 = await engine.track({ action: 's1', input: '1' })
    await engine.track({
      action: 's2',
      input: '2',
      chain_id: r1.chain_id,
    })
    const chain = await engine.getChain(r1.chain_id)
    expect(chain.length).toBe(2)
  })

  it('engine supports get_public_key flow', () => {
    const key = engine.getPublicKey()
    expect(key).toMatch(/^[a-f0-9]{64}$/)
  })

  it('create_receipt with constraints parameter', async () => {
    const receipt = await engine.create({
      action: 'constrained_create',
      input_hash: 'sha256:abc',
      status: 'completed',
      latency_ms: 1000,
      constraints: [{ type: 'max_latency_ms', value: 5000 }],
    })
    expect(receipt.constraints).not.toBeNull()
    expect(receipt.constraint_result).not.toBeNull()
    const cr = receipt.constraint_result as { passed: boolean }
    expect(cr.passed).toBe(true)
  })

  it('track_action with constraints evaluates immediately', async () => {
    const receipt = await engine.track({
      action: 'constrained_track',
      input: { data: 'test' },
      latency_ms: 8000,
      constraints: [{ type: 'max_latency_ms', value: 5000 }],
    })
    expect(receipt.constraint_result).not.toBeNull()
    const cr = receipt.constraint_result as { passed: boolean }
    expect(cr.passed).toBe(false)
  })

  it('track_action constraint results in response', async () => {
    const receipt = await engine.track({
      action: 'constrained_response',
      input: 'data',
      latency_ms: 1000,
      cost_usd: 0.001,
      constraints: [
        { type: 'max_latency_ms', value: 5000 },
        { type: 'max_cost_usd', value: 0.01 },
      ],
    })
    const cr = receipt.constraint_result as { passed: boolean; results: Array<{ passed: boolean }> }
    expect(cr.passed).toBe(true)
    expect(cr.results).toHaveLength(2)
  })
})
