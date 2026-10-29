import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteReceiptStore as ReceiptStore } from '../storage/sqlite-receipt-store.js'
import { KeyManager } from '../storage/key-manager.js'
import { ConfigManager } from '../storage/config-manager.js'
import { ReceiptEngine } from '../engine/receipt-engine.js'
import { verifyAnyReceipt, computeKeyId, hashReceipt } from '@agent-receipts/crypto'

describe('Receipt v2 in the engine', () => {
  let dir: string
  let store: ReceiptStore
  let keyManager: KeyManager
  let engine: ReceiptEngine

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ar-v2-'))
    store = new ReceiptStore(dir)
    await store.init()
    keyManager = new KeyManager(dir)
    await keyManager.init()
    const config = new ConfigManager(dir)
    await config.init()
    engine = new ReceiptEngine(store, keyManager, config)
  })

  afterEach(async () => {
    store.getDb().close()
    await rm(dir, { recursive: true, force: true })
  })

  it('signs new receipts as v2 with key_id, files and a null genesis link', async () => {
    const files = [{ name: 'a.txt', sha256: `sha256:${'b'.repeat(64)}`, bytes: 5, role: 'input' as const }]
    const r = await engine.track({ action: 'job', input: 'x', output_summary: 'did it', cost_usd: 0.02, files })
    expect(r.sig_version).toBe(2)
    expect(r.key_id).toBe(computeKeyId(keyManager.getPublicKey()))
    expect(r.prev_receipt_hash).toBeNull()
    expect(r.files).toEqual(files)
    expect(verifyAnyReceipt(r, keyManager.getPublicKey()).valid).toBe(true)
    expect(verifyAnyReceipt({ ...r, output_summary: 'edited' }, keyManager.getPublicKey()).valid).toBe(false)
  })

  it('verify() reports full-field coverage', async () => {
    const r = await engine.track({ action: 'job', input: 1 })
    const result = await engine.verify(r.receipt_id)
    expect(result.verified).toBe(true)
    expect(result.details.covers_all_fields).toBe(true)
  })

  it('links each finalized receipt to the previous one in its chain', async () => {
    const a = await engine.track({ action: 'one', input: 1 })
    const b = await engine.track({ action: 'two', input: 2, chain_id: a.chain_id })
    expect(b.prev_receipt_hash).toBe(hashReceipt(a))

    const pending = await engine.create({ action: 'three', input_hash: 'sha256:3', chain_id: a.chain_id })
    expect(pending.prev_receipt_hash).toBeNull()
    const c = await engine.complete(pending.receipt_id, { status: 'completed' })
    expect(c.prev_receipt_hash).toBe(hashReceipt(b))

    const chain = await engine.verifyChain(a.chain_id)
    expect(chain.valid).toBe(true)
    expect(chain.receipts).toHaveLength(3)
  })

  it('refuses to overwrite a finalized receipt', async () => {
    const r = await engine.track({ action: 'job', input: 1 })
    await expect(store.save({ ...r, output_summary: 'rewritten' })).rejects.toThrow('RECEIPT_IMMUTABLE')
  })

  it('still lets complete() finalize a pending receipt', async () => {
    const p = await engine.create({ action: 'job', input_hash: 'sha256:1' })
    const done = await engine.complete(p.receipt_id, { status: 'failed', error: { message: 'boom' } })
    expect(done.status).toBe('failed')
    expect(done.completed_at).not.toBeNull()
  })

  it('verifyChain catches an edited receipt', async () => {
    const a = await engine.track({ action: 'one', input: 1 })
    const b = await engine.track({ action: 'two', input: 2, chain_id: a.chain_id })
    const edited = { ...a, output_summary: 'edited behind our back' }
    store.getDb().prepare('UPDATE receipts SET data = ? WHERE receipt_id = ?').run(JSON.stringify(edited), a.receipt_id)

    const chain = await engine.verifyChain(a.chain_id)
    expect(chain.valid).toBe(false)
    expect(chain.problems.join(' ')).toContain(a.receipt_id)
    expect(chain.problems.join(' ')).toContain(b.receipt_id)
  })

  it('verifyChain catches a deleted receipt in the middle of a chain', async () => {
    const a = await engine.track({ action: 'one', input: 1 })
    const b = await engine.track({ action: 'two', input: 2, chain_id: a.chain_id })
    const c = await engine.track({ action: 'three', input: 3, chain_id: a.chain_id })
    await store.delete(b.receipt_id)

    const chain = await engine.verifyChain(a.chain_id)
    expect(chain.valid).toBe(false)
    expect(chain.problems.join(' ')).toContain(c.receipt_id)
  })

  it('verifyChain catches a fork', async () => {
    const a = await engine.track({ action: 'one', input: 1 })
    await engine.track({ action: 'two', input: 2, chain_id: a.chain_id })
    // A second receipt forged to hang off the same parent
    const forged = await engine.track({ action: 'other', input: 9 })
    const db = store.getDb()
    const row = db.prepare('SELECT data FROM receipts WHERE receipt_id = ?').get(forged.receipt_id) as { data: string }
    const moved = { ...JSON.parse(row.data), chain_id: a.chain_id, prev_receipt_hash: hashReceipt(a) }
    db.prepare('UPDATE receipts SET chain_id = ?, data = ? WHERE receipt_id = ?')
      .run(a.chain_id, JSON.stringify(moved), forged.receipt_id)

    const chain = await engine.verifyChain(a.chain_id)
    expect(chain.valid).toBe(false)
  })
})
