import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ReceiptStore } from '../storage/receipt-store.js'
import type { ActionReceipt } from '@agentreceipts/schema'

function makeReceipt(overrides: Partial<ActionReceipt> = {}): ActionReceipt {
  return {
    receipt_id: `rcpt_test${Math.random().toString(36).slice(2, 8)}`,
    parent_receipt_id: null,
    chain_id: 'chain_test1',
    receipt_type: 'action',
    agent_id: 'test-agent',
    org_id: 'local-org',
    action: 'test_action',
    input_hash: 'sha256:abc123',
    output_hash: null,
    output_summary: null,
    model: null,
    tokens_in: null,
    tokens_out: null,
    cost_usd: null,
    latency_ms: null,
    tool_calls: null,
    timestamp: new Date().toISOString(),
    completed_at: null,
    status: 'pending',
    error: null,
    environment: 'test',
    tags: null,
    constraints: null,
    constraint_result: null,
    signature: 'ed25519:test',
    verify_url: 'local://verify/rcpt_test',
    callback_verified: null,
    confidence: null,
    metadata: {},
    ...overrides,
  }
}

describe('ReceiptStore', () => {
  let tmpDir: string
  let store: ReceiptStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'receipt-store-'))
    store = new ReceiptStore(tmpDir)
    await store.init()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('saves and retrieves a receipt', async () => {
    const receipt = makeReceipt({ receipt_id: 'rcpt_save1' })
    await store.save(receipt)
    const fetched = await store.get('rcpt_save1')
    expect(fetched).not.toBeNull()
    expect(fetched!.receipt_id).toBe('rcpt_save1')
    expect(fetched!.action).toBe('test_action')
  })

  it('returns null for non-existent receipt', async () => {
    const result = await store.get('rcpt_nonexistent')
    expect(result).toBeNull()
  })

  it('checks existence', async () => {
    const receipt = makeReceipt({ receipt_id: 'rcpt_exists1' })
    await store.save(receipt)
    expect(await store.exists('rcpt_exists1')).toBe(true)
    expect(await store.exists('rcpt_nope')).toBe(false)
  })

  it('lists all receipts', async () => {
    await store.save(makeReceipt({ receipt_id: 'rcpt_list1' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_list2' }))
    const result = await store.list()
    expect(result.data.length).toBe(2)
    expect(result.pagination.total).toBe(2)
  })

  it('filters by agent_id', async () => {
    await store.save(makeReceipt({ receipt_id: 'rcpt_f1', agent_id: 'agent-a' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_f2', agent_id: 'agent-b' }))
    const result = await store.list({ agent_id: 'agent-a' })
    expect(result.data.length).toBe(1)
    expect(result.data[0]!.agent_id).toBe('agent-a')
  })

  it('filters by status', async () => {
    await store.save(makeReceipt({ receipt_id: 'rcpt_s1', status: 'pending' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_s2', status: 'completed' }))
    const result = await store.list({ status: 'completed' })
    expect(result.data.length).toBe(1)
    expect(result.data[0]!.status).toBe('completed')
  })

  it('filters by action', async () => {
    await store.save(makeReceipt({ receipt_id: 'rcpt_a1', action: 'foo' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_a2', action: 'bar' }))
    const result = await store.list({ action: 'foo' })
    expect(result.data.length).toBe(1)
  })

  it('filters by tag', async () => {
    await store.save(makeReceipt({ receipt_id: 'rcpt_t1', tags: ['alpha', 'beta'] }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_t2', tags: ['gamma'] }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_t3', tags: null }))
    const result = await store.list({ tag: 'alpha' })
    expect(result.data.length).toBe(1)
    expect(result.data[0]!.receipt_id).toBe('rcpt_t1')
  })

  it('filters by chain_id', async () => {
    await store.save(makeReceipt({ receipt_id: 'rcpt_c1', chain_id: 'chain_a' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_c2', chain_id: 'chain_b' }))
    const result = await store.list({ chain_id: 'chain_a' })
    expect(result.data.length).toBe(1)
  })

  it('paginates results', async () => {
    for (let i = 0; i < 5; i++) {
      await store.save(makeReceipt({
        receipt_id: `rcpt_page${i}`,
        timestamp: new Date(2026, 0, i + 1).toISOString(),
      }))
    }
    const page1 = await store.list(undefined, 1, 2)
    expect(page1.data.length).toBe(2)
    expect(page1.pagination.total).toBe(5)
    expect(page1.pagination.total_pages).toBe(3)
    expect(page1.pagination.has_next).toBe(true)
    expect(page1.pagination.has_prev).toBe(false)

    const page2 = await store.list(undefined, 2, 2)
    expect(page2.data.length).toBe(2)
    expect(page2.pagination.has_prev).toBe(true)
    expect(page2.pagination.has_next).toBe(true)

    const page3 = await store.list(undefined, 3, 2)
    expect(page3.data.length).toBe(1)
    expect(page3.pagination.has_next).toBe(false)
  })

  it('sorts by timestamp ascending', async () => {
    await store.save(makeReceipt({ receipt_id: 'rcpt_sort1', timestamp: '2026-01-03T00:00:00.000Z' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_sort2', timestamp: '2026-01-01T00:00:00.000Z' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_sort3', timestamp: '2026-01-02T00:00:00.000Z' }))
    const result = await store.list(undefined, 1, 50, 'timestamp:asc')
    expect(result.data[0]!.receipt_id).toBe('rcpt_sort2')
    expect(result.data[1]!.receipt_id).toBe('rcpt_sort3')
    expect(result.data[2]!.receipt_id).toBe('rcpt_sort1')
  })

  it('sorts by timestamp descending (default)', async () => {
    await store.save(makeReceipt({ receipt_id: 'rcpt_sd1', timestamp: '2026-01-01T00:00:00.000Z' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_sd2', timestamp: '2026-01-03T00:00:00.000Z' }))
    const result = await store.list(undefined, 1, 50, 'timestamp:desc')
    expect(result.data[0]!.receipt_id).toBe('rcpt_sd2')
  })

  it('gets chain receipts sorted by timestamp', async () => {
    const chainId = 'chain_ordered'
    await store.save(makeReceipt({ receipt_id: 'rcpt_ch3', chain_id: chainId, timestamp: '2026-01-03T00:00:00.000Z' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_ch1', chain_id: chainId, timestamp: '2026-01-01T00:00:00.000Z' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_ch2', chain_id: chainId, timestamp: '2026-01-02T00:00:00.000Z' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_other', chain_id: 'chain_other' }))

    const chain = await store.getChain(chainId)
    expect(chain.length).toBe(3)
    expect(chain[0]!.receipt_id).toBe('rcpt_ch1')
    expect(chain[1]!.receipt_id).toBe('rcpt_ch2')
    expect(chain[2]!.receipt_id).toBe('rcpt_ch3')
  })

  it('overwrites receipt with same ID (atomic update)', async () => {
    const r = makeReceipt({ receipt_id: 'rcpt_update', status: 'pending' })
    await store.save(r)
    const updated = { ...r, status: 'completed' as const, completed_at: new Date().toISOString() }
    await store.save(updated)
    const fetched = await store.get('rcpt_update')
    expect(fetched!.status).toBe('completed')
  })

  it('counts receipts with filter', async () => {
    await store.save(makeReceipt({ receipt_id: 'rcpt_cnt1', status: 'pending' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_cnt2', status: 'completed' }))
    await store.save(makeReceipt({ receipt_id: 'rcpt_cnt3', status: 'completed' }))
    expect(await store.count({ status: 'completed' })).toBe(2)
    expect(await store.count()).toBe(3)
  })

  it('deletes a receipt', async () => {
    await store.save(makeReceipt({ receipt_id: 'rcpt_del1' }))
    expect(await store.exists('rcpt_del1')).toBe(true)
    const deleted = await store.delete('rcpt_del1')
    expect(deleted).toBe(true)
    expect(await store.exists('rcpt_del1')).toBe(false)
  })

  it('returns false when deleting non-existent receipt', async () => {
    const deleted = await store.delete('rcpt_nope')
    expect(deleted).toBe(false)
  })
})
