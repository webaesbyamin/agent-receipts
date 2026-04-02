import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteReceiptStore as ReceiptStore } from '../storage/sqlite-receipt-store.js'
import { KeyManager } from '../storage/key-manager.js'
import { ConfigManager } from '../storage/config-manager.js'
import { ReceiptEngine } from '../engine/receipt-engine.js'

describe('Receipt TTL and Cleanup', () => {
  let tmpDir: string
  let engine: ReceiptEngine

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cleanup-test-'))
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

  it('create with ttl_ms sets expires_at in metadata', async () => {
    const before = Date.now()
    const receipt = await engine.track({
      action: 'ttl_test',
      input: 'data',
      ttl_ms: 60000, // 1 minute
    })
    const after = Date.now()

    const metadata = receipt.metadata as Record<string, unknown>
    expect(metadata.expires_at).toBeDefined()

    const expiresAt = new Date(metadata.expires_at as string).getTime()
    expect(expiresAt).toBeGreaterThanOrEqual(before + 60000)
    expect(expiresAt).toBeLessThanOrEqual(after + 60000)
  })

  it('create with expires_at stores in metadata', async () => {
    const expiresAt = '2026-12-31T23:59:59.000Z'
    const receipt = await engine.track({
      action: 'expires_test',
      input: 'data',
      expires_at: expiresAt,
    })

    const metadata = receipt.metadata as Record<string, unknown>
    expect(metadata.expires_at).toBe(expiresAt)
  })

  it('cleanup deletes expired receipts', async () => {
    // Create a receipt that expired in the past
    await engine.track({
      action: 'expired_action',
      input: 'data',
      expires_at: '2020-01-01T00:00:00.000Z',
    })

    // Create a receipt that hasn't expired
    await engine.track({
      action: 'fresh_action',
      input: 'data',
      expires_at: '2099-12-31T23:59:59.000Z',
    })

    const result = await engine.cleanup()
    expect(result.deleted).toBe(1)
    expect(result.remaining).toBe(1)
  })

  it('cleanup keeps non-expired receipts', async () => {
    await engine.track({
      action: 'fresh',
      input: 'data',
      expires_at: '2099-12-31T23:59:59.000Z',
    })

    const result = await engine.cleanup()
    expect(result.deleted).toBe(0)
    expect(result.remaining).toBe(1)
  })

  it('cleanup keeps receipts without expires_at', async () => {
    await engine.track({
      action: 'no_ttl',
      input: 'data',
    })

    const result = await engine.cleanup()
    expect(result.deleted).toBe(0)
    expect(result.remaining).toBe(1)
  })

  it('cleanup returns correct counts', async () => {
    // 2 expired, 1 fresh, 1 no-TTL
    await engine.track({ action: 'expired1', input: '1', expires_at: '2020-01-01T00:00:00.000Z' })
    await engine.track({ action: 'expired2', input: '2', expires_at: '2020-06-01T00:00:00.000Z' })
    await engine.track({ action: 'fresh', input: '3', expires_at: '2099-12-31T23:59:59.000Z' })
    await engine.track({ action: 'no_ttl', input: '4' })

    const result = await engine.cleanup()
    expect(result.deleted).toBe(2)
    expect(result.remaining).toBe(2)
  })

  it('cleanup handles empty store', async () => {
    const result = await engine.cleanup()
    expect(result.deleted).toBe(0)
    expect(result.remaining).toBe(0)
  })

  it('ttl_ms is ignored when expires_at is also provided', async () => {
    const expiresAt = '2099-06-15T12:00:00.000Z'
    const receipt = await engine.track({
      action: 'both_test',
      input: 'data',
      expires_at: expiresAt,
      ttl_ms: 1000, // should be ignored since expires_at takes priority
    })

    const metadata = receipt.metadata as Record<string, unknown>
    expect(metadata.expires_at).toBe(expiresAt)
  })
})
