import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ReceiptStore } from '../storage/receipt-store.js'
import { KeyManager } from '../storage/key-manager.js'
import { ConfigManager } from '../storage/config-manager.js'
import { ReceiptEngine } from '../engine/receipt-engine.js'

describe('ReceiptEngine', () => {
  let tmpDir: string
  let engine: ReceiptEngine

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'receipt-engine-'))
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']

    const store = new ReceiptStore(tmpDir)
    await store.init()
    const keyManager = new KeyManager(tmpDir)
    await keyManager.init()
    const configManager = new ConfigManager(tmpDir)
    await configManager.init()

    engine = new ReceiptEngine(store, keyManager, configManager)
  })

  afterEach(async () => {
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']
    await rm(tmpDir, { recursive: true, force: true })
  })

  describe('create', () => {
    it('creates a pending receipt', async () => {
      const receipt = await engine.create({
        action: 'test_action',
        input_hash: 'sha256:abc123',
      })
      expect(receipt.receipt_id).toMatch(/^rcpt_/)
      expect(receipt.chain_id).toMatch(/^chain_/)
      expect(receipt.status).toBe('pending')
      expect(receipt.action).toBe('test_action')
      expect(receipt.input_hash).toBe('sha256:abc123')
      expect(receipt.signature).toMatch(/^ed25519:/)
      expect(receipt.verify_url).toContain('local://verify/')
    })

    it('creates a completed receipt when status specified', async () => {
      const receipt = await engine.create({
        action: 'done_action',
        input_hash: 'sha256:def',
        status: 'completed',
      })
      expect(receipt.status).toBe('completed')
      expect(receipt.completed_at).not.toBeNull()
    })

    it('uses provided chain_id', async () => {
      const receipt = await engine.create({
        action: 'test',
        input_hash: 'sha256:x',
        chain_id: 'chain_custom',
      })
      expect(receipt.chain_id).toBe('chain_custom')
    })

    it('uses provided parent_receipt_id', async () => {
      const receipt = await engine.create({
        action: 'test',
        input_hash: 'sha256:x',
        parent_receipt_id: 'rcpt_parent123',
      })
      expect(receipt.parent_receipt_id).toBe('rcpt_parent123')
    })

    it('sets optional fields', async () => {
      const receipt = await engine.create({
        action: 'test',
        input_hash: 'sha256:x',
        model: 'gpt-4',
        tokens_in: 100,
        tokens_out: 200,
        cost_usd: 0.005,
        latency_ms: 500,
        tags: ['test'],
        confidence: 0.95,
        metadata: { key: 'value' },
      })
      expect(receipt.model).toBe('gpt-4')
      expect(receipt.tokens_in).toBe(100)
      expect(receipt.tokens_out).toBe(200)
      expect(receipt.cost_usd).toBe(0.005)
      expect(receipt.latency_ms).toBe(500)
      expect(receipt.tags).toEqual(['test'])
      expect(receipt.confidence).toBe(0.95)
      expect(receipt.metadata).toEqual({ key: 'value' })
    })

    it('validates against ActionReceipt schema', async () => {
      const receipt = await engine.create({
        action: 'test',
        input_hash: 'sha256:x',
      })
      // If parse() didn't throw, schema validation passed
      expect(receipt.receipt_id).toBeDefined()
      expect(receipt.signature).toBeDefined()
    })
  })

  describe('complete', () => {
    it('completes a pending receipt', async () => {
      const created = await engine.create({
        action: 'pending_action',
        input_hash: 'sha256:input',
      })
      expect(created.status).toBe('pending')

      const completed = await engine.complete(created.receipt_id, {
        status: 'completed',
        output_hash: 'sha256:output',
        output_summary: 'Done!',
        latency_ms: 100,
      })
      expect(completed.status).toBe('completed')
      expect(completed.completed_at).not.toBeNull()
      expect(completed.output_hash).toBe('sha256:output')
      expect(completed.output_summary).toBe('Done!')
      expect(completed.latency_ms).toBe(100)
    })

    it('re-signs the receipt', async () => {
      const created = await engine.create({
        action: 'resign_test',
        input_hash: 'sha256:x',
      })
      const completed = await engine.complete(created.receipt_id, {
        status: 'completed',
      })
      expect(completed.signature).not.toBe(created.signature)
    })

    it('throws for non-existent receipt', async () => {
      await expect(engine.complete('rcpt_nope', { status: 'completed' }))
        .rejects.toThrow('not found')
    })

    it('throws for non-pending receipt', async () => {
      const created = await engine.create({
        action: 'test',
        input_hash: 'sha256:x',
        status: 'completed',
      })
      await expect(engine.complete(created.receipt_id, { status: 'failed' }))
        .rejects.toThrow('not pending')
    })

    it('can set failed status with error', async () => {
      const created = await engine.create({
        action: 'fail_test',
        input_hash: 'sha256:x',
      })
      const failed = await engine.complete(created.receipt_id, {
        status: 'failed',
        error: { code: 'TIMEOUT', message: 'Request timed out' },
      })
      expect(failed.status).toBe('failed')
      expect(failed.error).toEqual({ code: 'TIMEOUT', message: 'Request timed out' })
    })
  })

  describe('track', () => {
    it('creates a completed receipt with auto-hashing', async () => {
      const receipt = await engine.track({
        action: 'summarize',
        input: { text: 'Hello world' },
        output: { summary: 'Greeting' },
      })
      expect(receipt.status).toBe('completed')
      expect(receipt.completed_at).not.toBeNull()
      expect(receipt.input_hash).toMatch(/^sha256:/)
      expect(receipt.output_hash).toMatch(/^sha256:/)
    })

    it('handles track without output', async () => {
      const receipt = await engine.track({
        action: 'log_event',
        input: { event: 'click' },
      })
      expect(receipt.input_hash).toMatch(/^sha256:/)
      expect(receipt.output_hash).toBeNull()
    })

    it('sets all optional fields', async () => {
      const receipt = await engine.track({
        action: 'test',
        input: 'hello',
        output: 'world',
        model: 'gpt-4',
        tokens_in: 10,
        tokens_out: 5,
        cost_usd: 0.001,
        latency_ms: 200,
        tool_calls: ['tool1'],
        tags: ['demo'],
        confidence: 0.9,
        metadata: { v: 1 },
        output_summary: 'greeting response',
      })
      expect(receipt.model).toBe('gpt-4')
      expect(receipt.tokens_in).toBe(10)
      expect(receipt.tags).toEqual(['demo'])
      expect(receipt.output_summary).toBe('greeting response')
    })

    it('inherits chain_id from parent', async () => {
      const parent = await engine.track({
        action: 'step1',
        input: 'data',
      })
      const child = await engine.track({
        action: 'step2',
        input: 'more data',
        parent_receipt_id: parent.receipt_id,
        chain_id: parent.chain_id,
      })
      expect(child.chain_id).toBe(parent.chain_id)
      expect(child.parent_receipt_id).toBe(parent.receipt_id)
    })
  })

  describe('verify', () => {
    it('verifies a valid receipt', async () => {
      const receipt = await engine.track({
        action: 'verify_test',
        input: 'data',
      })
      const result = await engine.verify(receipt.receipt_id)
      expect(result.verified).toBe(true)
      expect(result.receipt.receipt_id).toBe(receipt.receipt_id)
    })

    it('verifies a completed receipt (re-signed)', async () => {
      const created = await engine.create({
        action: 'test',
        input_hash: 'sha256:x',
      })
      const completed = await engine.complete(created.receipt_id, {
        status: 'completed',
      })
      const result = await engine.verify(completed.receipt_id)
      expect(result.verified).toBe(true)
    })

    it('throws for non-existent receipt', async () => {
      await expect(engine.verify('rcpt_nope')).rejects.toThrow('not found')
    })
  })

  describe('get', () => {
    it('returns receipt by ID', async () => {
      const receipt = await engine.track({ action: 'get_test', input: 'x' })
      const fetched = await engine.get(receipt.receipt_id)
      expect(fetched).not.toBeNull()
      expect(fetched!.receipt_id).toBe(receipt.receipt_id)
    })

    it('returns null for non-existent', async () => {
      const result = await engine.get('rcpt_nope')
      expect(result).toBeNull()
    })
  })

  describe('list', () => {
    it('lists all receipts', async () => {
      await engine.track({ action: 'a', input: '1' })
      await engine.track({ action: 'b', input: '2' })
      const result = await engine.list()
      expect(result.data.length).toBe(2)
    })

    it('filters by action', async () => {
      await engine.track({ action: 'alpha', input: '1' })
      await engine.track({ action: 'beta', input: '2' })
      const result = await engine.list({ action: 'alpha' })
      expect(result.data.length).toBe(1)
      expect(result.data[0]!.action).toBe('alpha')
    })
  })

  describe('getChain', () => {
    it('returns chain receipts in order', async () => {
      const r1 = await engine.track({ action: 'step1', input: '1' })
      await engine.track({
        action: 'step2',
        input: '2',
        chain_id: r1.chain_id,
        parent_receipt_id: r1.receipt_id,
      })
      const chain = await engine.getChain(r1.chain_id)
      expect(chain.length).toBe(2)
      expect(chain[0]!.action).toBe('step1')
      expect(chain[1]!.action).toBe('step2')
    })

    it('returns empty array for unknown chain', async () => {
      const chain = await engine.getChain('chain_unknown')
      expect(chain).toEqual([])
    })
  })

  describe('getPublicKey', () => {
    it('returns hex-encoded public key', () => {
      const key = engine.getPublicKey()
      expect(key).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('constraints', () => {
    it('create with constraints stores them', async () => {
      const receipt = await engine.create({
        action: 'test',
        input_hash: 'sha256:x',
        constraints: [{ type: 'max_latency_ms', value: 5000 }],
      })
      expect(receipt.constraints).not.toBeNull()
      const stored = receipt.constraints as { definitions: Array<{ type: string; value: unknown }> }
      expect(stored.definitions).toHaveLength(1)
      expect(stored.definitions[0]!.type).toBe('max_latency_ms')
    })

    it('create without constraints → null', async () => {
      const receipt = await engine.create({
        action: 'test',
        input_hash: 'sha256:x',
      })
      expect(receipt.constraints).toBeNull()
      expect(receipt.constraint_result).toBeNull()
    })

    it('track with constraints: all pass', async () => {
      const receipt = await engine.track({
        action: 'test',
        input: 'data',
        latency_ms: 1000,
        cost_usd: 0.001,
        confidence: 0.95,
        constraints: [
          { type: 'max_latency_ms', value: 5000 },
          { type: 'max_cost_usd', value: 0.01 },
          { type: 'min_confidence', value: 0.8 },
        ],
      })
      expect(receipt.constraint_result).not.toBeNull()
      const cr = receipt.constraint_result as { passed: boolean; results: Array<{ passed: boolean }> }
      expect(cr.passed).toBe(true)
      expect(cr.results).toHaveLength(3)
      expect(cr.results.every((r) => r.passed)).toBe(true)
    })

    it('track with constraints: one fails', async () => {
      const receipt = await engine.track({
        action: 'test',
        input: 'data',
        latency_ms: 8000,
        cost_usd: 0.001,
        constraints: [
          { type: 'max_latency_ms', value: 5000 },
          { type: 'max_cost_usd', value: 0.01 },
        ],
      })
      const cr = receipt.constraint_result as { passed: boolean; results: Array<{ passed: boolean }> }
      expect(cr.passed).toBe(false)
      expect(cr.results[0]!.passed).toBe(false)
      expect(cr.results[1]!.passed).toBe(true)
    })

    it('complete evaluates stored constraints', async () => {
      const pending = await engine.create({
        action: 'test',
        input_hash: 'sha256:x',
        constraints: [{ type: 'max_latency_ms', value: 5000 }],
      })
      expect(pending.constraint_result).toBeNull() // pending — not evaluated yet

      const completed = await engine.complete(pending.receipt_id, {
        status: 'completed',
        latency_ms: 2000,
      })
      const cr = completed.constraint_result as { passed: boolean; results: Array<{ passed: boolean }> }
      expect(cr.passed).toBe(true)
    })

    it('receipt exists even if constraints fail', async () => {
      const receipt = await engine.track({
        action: 'test',
        input: 'data',
        latency_ms: 10000,
        constraints: [{ type: 'max_latency_ms', value: 5000 }],
      })
      expect(receipt.receipt_id).toMatch(/^rcpt_/)
      const cr = receipt.constraint_result as { passed: boolean }
      expect(cr.passed).toBe(false)

      // Verify it was persisted
      const fetched = await engine.get(receipt.receipt_id)
      expect(fetched).not.toBeNull()
    })

    it('constraint_result has correct structure', async () => {
      const receipt = await engine.track({
        action: 'test',
        input: 'data',
        latency_ms: 1000,
        constraints: [{ type: 'max_latency_ms', value: 5000 }],
      })
      const cr = receipt.constraint_result as { passed: boolean; results: Array<{ type: string; passed: boolean; expected: unknown; actual: unknown }>; evaluated_at: string }
      expect(typeof cr.passed).toBe('boolean')
      expect(Array.isArray(cr.results)).toBe(true)
      expect(cr.results[0]!.type).toBe('max_latency_ms')
      expect(typeof cr.results[0]!.passed).toBe('boolean')
      expect(cr.results[0]!.expected).toBe(5000)
      expect(cr.results[0]!.actual).toBe(1000)
      expect(cr.evaluated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })
})
