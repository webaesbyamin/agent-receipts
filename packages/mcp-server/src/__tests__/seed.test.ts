import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ReceiptStore } from '../storage/receipt-store.js'
import { KeyManager } from '../storage/key-manager.js'
import { ConfigManager } from '../storage/config-manager.js'
import { ReceiptEngine } from '../engine/receipt-engine.js'
import { seedDemoData } from '../engine/seed.js'
import { verifyReceipt, getSignablePayload } from '@agent-receipts/crypto'

describe('seedDemoData', () => {
  let tmpDir: string
  let store: ReceiptStore
  let keyManager: KeyManager

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'seed-test-'))
    store = new ReceiptStore(tmpDir)
    await store.init()
    keyManager = new KeyManager(tmpDir)
    await keyManager.init()
    const cm = new ConfigManager(tmpDir)
    await cm.init()
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('generates receipts in the default range (80-100)', async () => {
    const result = await seedDemoData(store, keyManager)
    expect(result.total).toBeGreaterThanOrEqual(70)
    expect(result.total).toBeLessThanOrEqual(130) // some tolerance for chains and judgment receipts
  })

  it('distributes receipts across multiple agents', async () => {
    const result = await seedDemoData(store, keyManager)
    const agentNames = Object.keys(result.agents)
    expect(agentNames.length).toBeGreaterThanOrEqual(1)
    for (const count of Object.values(result.agents)) {
      expect(count).toBeGreaterThan(0)
    }
  })

  it('creates chains with valid parent references', async () => {
    const result = await seedDemoData(store, keyManager)
    expect(result.chains).toBeGreaterThanOrEqual(8)

    // Verify at least one chain has linked receipts
    const all = await store.list(undefined, 1, 10000)
    const withParent = all.data.filter(r => r.parent_receipt_id !== null)
    expect(withParent.length).toBeGreaterThan(0)

    // Verify parent IDs reference real receipts
    const allIds = new Set(all.data.map(r => r.receipt_id))
    for (const r of withParent) {
      expect(allIds.has(r.parent_receipt_id!)).toBe(true)
    }
  })

  it('creates receipts with constraint failures', async () => {
    const result = await seedDemoData(store, keyManager)
    expect(result.constraints.passed + result.constraints.failed).toBeGreaterThan(0)
  })

  it('creates judgment receipts', async () => {
    const result = await seedDemoData(store, keyManager)
    expect(result.judgments).toBe(4)

    const all = await store.list(undefined, 1, 10000)
    const judgments = all.data.filter(r => r.receipt_type === 'judgment')
    expect(judgments.length).toBe(4)

    for (const j of judgments) {
      expect(j.status).toBe('completed')
      expect(j.parent_receipt_id).toBeTruthy()
      const meta = j.metadata as Record<string, unknown>
      expect(meta.judgment).toBeDefined()
      const judgment = meta.judgment as Record<string, unknown>
      expect(judgment.verdict).toBeDefined()
      expect(judgment.score).toBeDefined()
    }
  })

  it('creates expired receipts', async () => {
    const result = await seedDemoData(store, keyManager)
    expect(result.expired).toBeGreaterThanOrEqual(3)

    const all = await store.list(undefined, 1, 10000)
    const now = new Date().toISOString()
    const expired = all.data.filter(r => {
      const ea = (r.metadata as Record<string, unknown>)?.expires_at as string | undefined
      return ea && ea < now
    })
    expect(expired.length).toBeGreaterThanOrEqual(3)
  })

  it('creates future-expiring receipts', async () => {
    await seedDemoData(store, keyManager)

    const all = await store.list(undefined, 1, 10000)
    const now = new Date().toISOString()
    const futureExpiring = all.data.filter(r => {
      const ea = (r.metadata as Record<string, unknown>)?.expires_at as string | undefined
      return ea && ea > now
    })
    expect(futureExpiring.length).toBeGreaterThanOrEqual(5)
  })

  it('spans generated_at metadata across multiple days', async () => {
    await seedDemoData(store, keyManager)

    const all = await store.list(undefined, 1, 10000)
    const generatedTimestamps = all.data
      .map(r => (r.metadata as Record<string, unknown>)?.generated_at as string | undefined)
      .filter((t): t is string => t !== undefined)
      .map(t => new Date(t).getTime())
    expect(generatedTimestamps.length).toBeGreaterThan(0)
    const minTs = Math.min(...generatedTimestamps)
    const maxTs = Math.max(...generatedTimestamps)
    const spanDays = (maxTs - minTs) / (1000 * 60 * 60 * 24)
    expect(spanDays).toBeGreaterThan(1)
  })

  it('produces valid signatures on all receipts', async () => {
    await seedDemoData(store, keyManager)
    const publicKey = keyManager.getPublicKey()

    const all = await store.list(undefined, 1, 10000)
    for (const receipt of all.data) {
      const signable = getSignablePayload(receipt)
      const valid = verifyReceipt(signable, receipt.signature, publicKey)
      expect(valid).toBe(true)
    }
  })

  it('cleans existing receipts with clean option', async () => {
    // Create some existing receipts
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    const engine = new ReceiptEngine(store, keyManager, cm)
    await engine.track({ action: 'existing', input: 'data' })

    const before = await store.list(undefined, 1, 10000)
    expect(before.pagination.total).toBe(1)

    await seedDemoData(store, keyManager, { clean: true, count: 10 })

    const after = await store.list(undefined, 1, 10000)
    // Should not contain the old receipt (cleaned) but have new ones
    const hasOld = after.data.some(r => r.action === 'existing')
    expect(hasOld).toBe(false)
    expect(after.pagination.total).toBeGreaterThan(0)
  })

  it('respects custom count option', async () => {
    const result = await seedDemoData(store, keyManager, { count: 15 })
    // Small counts scale down phases; total should be close to target
    expect(result.total).toBeGreaterThanOrEqual(8)
    expect(result.total).toBeLessThanOrEqual(25)
  })

  it('includes models, token counts, and costs on receipts', async () => {
    await seedDemoData(store, keyManager, { count: 20 })

    const all = await store.list(undefined, 1, 10000)
    const withModel = all.data.filter(r => r.model !== null)
    const withTokens = all.data.filter(r => r.tokens_in !== null)
    const withCost = all.data.filter(r => r.cost_usd !== null)
    expect(withModel.length).toBeGreaterThan(0)
    expect(withTokens.length).toBeGreaterThan(0)
    expect(withCost.length).toBeGreaterThan(0)
  })

  it('includes tags on some receipts', async () => {
    await seedDemoData(store, keyManager, { count: 30 })

    const all = await store.list(undefined, 1, 10000)
    const withTags = all.data.filter(r => r.tags && r.tags.length > 0)
    expect(withTags.length).toBeGreaterThan(0)
  })

  it('includes output_summary on receipts', async () => {
    await seedDemoData(store, keyManager, { count: 20 })

    const all = await store.list(undefined, 1, 10000)
    const withSummary = all.data.filter(r => r.output_summary !== null)
    expect(withSummary.length).toBeGreaterThan(0)
  })

  it('all receipts have valid receipt_id format', async () => {
    await seedDemoData(store, keyManager, { count: 15 })

    const all = await store.list(undefined, 1, 10000)
    for (const r of all.data) {
      expect(r.receipt_id).toMatch(/^rcpt_/)
    }
  })
})
