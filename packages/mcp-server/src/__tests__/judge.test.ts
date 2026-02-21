import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ReceiptStore } from '../storage/receipt-store.js'
import { KeyManager } from '../storage/key-manager.js'
import { ConfigManager } from '../storage/config-manager.js'
import { ReceiptEngine } from '../engine/receipt-engine.js'
import { hashData } from '../hash.js'
import { verifyReceipt, getSignablePayload } from '@agent-receipts/crypto'

describe('AI Judge', () => {
  let tmpDir: string
  let engine: ReceiptEngine
  let keyManager: KeyManager

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'judge-test-'))
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']

    const store = new ReceiptStore(tmpDir)
    await store.init()
    keyManager = new KeyManager(tmpDir)
    await keyManager.init()
    const configManager = new ConfigManager(tmpDir)
    await configManager.init()

    engine = new ReceiptEngine(store, keyManager, configManager)
  })

  afterEach(async () => {
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']
    await rm(tmpDir, { recursive: true, force: true })
  })

  async function createCompletedReceipt() {
    return engine.track({
      action: 'generate_report',
      input: { query: 'Q4 revenue analysis' },
      output: { total: 142000, currency: 'USD' },
      output_summary: 'Generated Q4 revenue report: $142,000',
      latency_ms: 2340,
      cost_usd: 0.008,
      confidence: 0.92,
    })
  }

  async function createPendingJudgment(parentReceiptId: string, chainId: string) {
    return engine.create({
      receipt_type: 'judgment',
      action: 'judge',
      input_hash: hashData({ receipt_id: parentReceiptId }),
      parent_receipt_id: parentReceiptId,
      chain_id: chainId,
      status: 'pending',
      metadata: {
        rubric_hash: hashData({ version: '1.0' }),
        rubric_version: '1.0',
      },
    })
  }

  describe('judge_receipt flow', () => {
    it('creates pending judgment receipt with correct type', async () => {
      const parent = await createCompletedReceipt()
      const judgment = await createPendingJudgment(parent.receipt_id, parent.chain_id)

      expect(judgment.receipt_type).toBe('judgment')
      expect(judgment.status).toBe('pending')
      expect(judgment.parent_receipt_id).toBe(parent.receipt_id)
    })

    it('inherits chain_id from parent', async () => {
      const parent = await createCompletedReceipt()
      const judgment = await createPendingJudgment(parent.receipt_id, parent.chain_id)
      expect(judgment.chain_id).toBe(parent.chain_id)
    })

    it('stores rubric hash in metadata', async () => {
      const parent = await createCompletedReceipt()
      const judgment = await createPendingJudgment(parent.receipt_id, parent.chain_id)
      const metadata = judgment.metadata as Record<string, unknown>
      expect(metadata.rubric_hash).toBeDefined()
      expect(metadata.rubric_version).toBe('1.0')
    })
  })

  describe('complete_judgment flow', () => {
    it('completes pending judgment receipt', async () => {
      const parent = await createCompletedReceipt()
      const pending = await createPendingJudgment(parent.receipt_id, parent.chain_id)

      const judgmentResult = {
        verdict: 'pass',
        score: 0.91,
        criteria_results: [
          { criterion: 'accuracy', score: 0.95, passed: true, reasoning: 'Correct pricing' },
        ],
        overall_reasoning: 'Quote was accurate and well-structured.',
        rubric_version: '1.0',
      }

      const completed = await engine.complete(pending.receipt_id, {
        status: 'completed',
        output_hash: hashData(judgmentResult),
        output_summary: `PASS (0.91) — Quote was accurate and well-structured.`,
        confidence: 0.88,
        metadata: {
          ...pending.metadata,
          judgment: judgmentResult,
        },
      })

      expect(completed.status).toBe('completed')
      expect(completed.completed_at).not.toBeNull()
    })

    it('stores judgment result in metadata', async () => {
      const parent = await createCompletedReceipt()
      const pending = await createPendingJudgment(parent.receipt_id, parent.chain_id)

      const judgmentResult = {
        verdict: 'pass',
        score: 0.91,
        criteria_results: [
          { criterion: 'accuracy', score: 0.95, passed: true, reasoning: 'Correct' },
        ],
        overall_reasoning: 'Good output.',
        rubric_version: '1.0',
      }

      const completed = await engine.complete(pending.receipt_id, {
        status: 'completed',
        output_hash: hashData(judgmentResult),
        output_summary: 'PASS (0.91)',
        confidence: 0.88,
        metadata: {
          ...pending.metadata,
          judgment: judgmentResult,
        },
      })

      const meta = completed.metadata as Record<string, unknown>
      const stored = meta.judgment as Record<string, unknown>
      expect(stored.verdict).toBe('pass')
      expect(stored.score).toBe(0.91)
    })

    it('sets output_hash from judgment', async () => {
      const parent = await createCompletedReceipt()
      const pending = await createPendingJudgment(parent.receipt_id, parent.chain_id)

      const judgmentResult = { verdict: 'fail', score: 0.3 }
      const completed = await engine.complete(pending.receipt_id, {
        status: 'completed',
        output_hash: hashData(judgmentResult),
        output_summary: 'FAIL (0.30)',
      })

      expect(completed.output_hash).toMatch(/^sha256:/)
    })

    it('sets confidence from input', async () => {
      const parent = await createCompletedReceipt()
      const pending = await createPendingJudgment(parent.receipt_id, parent.chain_id)

      const completed = await engine.complete(pending.receipt_id, {
        status: 'completed',
        output_hash: hashData({ verdict: 'pass' }),
        confidence: 0.95,
      })
      expect(completed.confidence).toBe(0.95)
    })

    it('fails if judgment receipt does not exist', async () => {
      await expect(engine.complete('rcpt_nonexistent', {
        status: 'completed',
      })).rejects.toThrow('not found')
    })

    it('fails if receipt is not pending', async () => {
      const parent = await createCompletedReceipt()
      await expect(engine.complete(parent.receipt_id, {
        status: 'completed',
      })).rejects.toThrow('not pending')
    })

    it('re-signs completed receipt', async () => {
      const parent = await createCompletedReceipt()
      const pending = await createPendingJudgment(parent.receipt_id, parent.chain_id)

      const completed = await engine.complete(pending.receipt_id, {
        status: 'completed',
        output_hash: hashData({ verdict: 'pass' }),
      })

      expect(completed.signature).not.toBe(pending.signature)

      // Verify new signature is valid
      const signable = getSignablePayload(completed)
      const verified = verifyReceipt(signable, completed.signature, keyManager.getPublicKey())
      expect(verified).toBe(true)
    })
  })

  describe('get_judgments', () => {
    it('returns judgments for a receipt', async () => {
      const parent = await createCompletedReceipt()
      const pending = await createPendingJudgment(parent.receipt_id, parent.chain_id)

      await engine.complete(pending.receipt_id, {
        status: 'completed',
        output_hash: hashData({ verdict: 'pass' }),
        metadata: { ...pending.metadata, judgment: { verdict: 'pass', score: 0.9 } },
      })

      const judgments = await engine.getJudgments(parent.receipt_id)
      expect(judgments.length).toBe(1)
      expect(judgments[0]!.receipt_type).toBe('judgment')
      expect(judgments[0]!.parent_receipt_id).toBe(parent.receipt_id)
    })

    it('returns empty array if no judgments', async () => {
      const parent = await createCompletedReceipt()
      const judgments = await engine.getJudgments(parent.receipt_id)
      expect(judgments).toEqual([])
    })

    it('only returns judgment type receipts', async () => {
      const parent = await createCompletedReceipt()

      // Create a non-judgment child receipt
      await engine.track({
        action: 'step2',
        input: 'data',
        chain_id: parent.chain_id,
        parent_receipt_id: parent.receipt_id,
      })

      // Create a judgment receipt
      const pending = await createPendingJudgment(parent.receipt_id, parent.chain_id)
      await engine.complete(pending.receipt_id, {
        status: 'completed',
        output_hash: hashData({ verdict: 'pass' }),
      })

      const judgments = await engine.getJudgments(parent.receipt_id)
      expect(judgments.length).toBe(1)
      expect(judgments[0]!.receipt_type).toBe('judgment')
    })
  })

  describe('getJudgments engine method', () => {
    it('works end-to-end', async () => {
      const parent = await createCompletedReceipt()

      // Create and complete two judgments
      for (let i = 0; i < 2; i++) {
        const pending = await createPendingJudgment(parent.receipt_id, parent.chain_id)
        await engine.complete(pending.receipt_id, {
          status: 'completed',
          output_hash: hashData({ verdict: 'pass', iteration: i }),
        })
      }

      const judgments = await engine.getJudgments(parent.receipt_id)
      expect(judgments.length).toBe(2)
    })
  })
})
