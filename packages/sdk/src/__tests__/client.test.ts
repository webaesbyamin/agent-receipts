import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentReceipts } from '../index.js'

describe('AgentReceipts SDK', () => {
  let tmpDir: string
  let receipts: AgentReceipts

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sdk-test-'))
    receipts = new AgentReceipts({ dataDir: tmpDir })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('tracks an action (one-shot)', async () => {
    const receipt = await receipts.track({
      action: 'summarize',
      input: { text: 'Hello world' },
      output: { summary: 'Greeting' },
    })
    expect(receipt.receipt_id).toMatch(/^rcpt_/)
    expect(receipt.status).toBe('completed')
    expect(receipt.input_hash).toMatch(/^sha256:/)
    expect(receipt.output_hash).toMatch(/^sha256:/)
  })

  it('emit is an alias for track', async () => {
    const receipt = await receipts.emit({
      action: 'log',
      input: { event: 'click' },
    })
    expect(receipt.receipt_id).toMatch(/^rcpt_/)
    expect(receipt.status).toBe('completed')
  })

  it('start + complete (two-phase)', async () => {
    const pending = await receipts.start({
      action: 'process',
      input_hash: 'sha256:abc123',
    })
    expect(pending.status).toBe('pending')
    expect(pending.completed_at).toBeNull()

    const completed = await receipts.complete(pending.receipt_id, {
      status: 'completed',
      output_hash: 'sha256:def456',
      latency_ms: 150,
    })
    expect(completed.status).toBe('completed')
    expect(completed.completed_at).not.toBeNull()
    expect(completed.output_hash).toBe('sha256:def456')
  })

  it('verifies a receipt', async () => {
    const receipt = await receipts.track({
      action: 'test',
      input: 'data',
    })
    const { verified } = await receipts.verify(receipt.receipt_id)
    expect(verified).toBe(true)
  })

  it('gets a receipt by ID', async () => {
    const receipt = await receipts.track({
      action: 'test',
      input: 'data',
    })
    const fetched = await receipts.get(receipt.receipt_id)
    expect(fetched).not.toBeNull()
    expect(fetched!.receipt_id).toBe(receipt.receipt_id)
  })

  it('returns null for non-existent receipt', async () => {
    const result = await receipts.get('rcpt_nope')
    expect(result).toBeNull()
  })

  it('lists receipts', async () => {
    await receipts.track({ action: 'a', input: '1' })
    await receipts.track({ action: 'b', input: '2' })
    const result = await receipts.list()
    expect(result.data.length).toBe(2)
    expect(result.pagination.total).toBe(2)
  })

  it('lists receipts with filter', async () => {
    await receipts.track({ action: 'alpha', input: '1' })
    await receipts.track({ action: 'beta', input: '2' })
    const result = await receipts.list({ action: 'alpha' })
    expect(result.data.length).toBe(1)
    expect(result.data[0]!.action).toBe('alpha')
  })

  it('gets public key', async () => {
    const key = await receipts.getPublicKey()
    expect(key).toMatch(/^[a-f0-9]{64}$/)
  })

  it('chaining works through SDK', async () => {
    const r1 = await receipts.track({ action: 'step1', input: 'a' })
    const r2 = await receipts.track({
      action: 'step2',
      input: 'b',
      chain_id: r1.chain_id,
      parent_receipt_id: r1.receipt_id,
    })
    expect(r2.chain_id).toBe(r1.chain_id)
    expect(r2.parent_receipt_id).toBe(r1.receipt_id)

    const result = await receipts.list({ chain_id: r1.chain_id })
    expect(result.data.length).toBe(2)
  })

  it('track with constraints returns constraint results', async () => {
    const receipt = await receipts.track({
      action: 'constrained_action',
      input: 'data',
      latency_ms: 1000,
      cost_usd: 0.001,
      constraints: [
        { type: 'max_latency_ms', value: 5000 },
        { type: 'max_cost_usd', value: 0.01 },
      ],
    })
    expect(receipt.constraint_result).not.toBeNull()
    const cr = receipt.constraint_result as { passed: boolean; results: Array<{ passed: boolean }> }
    expect(cr.passed).toBe(true)
    expect(cr.results).toHaveLength(2)
  })

  it('start with constraints stores them', async () => {
    const pending = await receipts.start({
      action: 'constrained_start',
      input_hash: 'sha256:abc',
      constraints: [{ type: 'max_latency_ms', value: 5000 }],
    })
    expect(pending.constraints).not.toBeNull()
    expect(pending.constraint_result).toBeNull() // not evaluated until completed

    const completed = await receipts.complete(pending.receipt_id, {
      status: 'completed',
      latency_ms: 2000,
    })
    const cr = completed.constraint_result as { passed: boolean }
    expect(cr.passed).toBe(true)
  })
})
