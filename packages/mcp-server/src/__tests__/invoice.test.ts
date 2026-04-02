import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteReceiptStore as ReceiptStore } from '../storage/sqlite-receipt-store.js'
import { KeyManager } from '../storage/key-manager.js'
import { ConfigManager } from '../storage/config-manager.js'
import { ReceiptEngine } from '../engine/receipt-engine.js'
import { generateInvoice } from '../engine/invoice.js'
import type { InvoiceOptions } from '../engine/invoice.js'
import {
  formatInvoiceJSON,
  formatInvoiceCSV,
  formatInvoiceMarkdown,
  formatInvoiceHTML,
} from '../engine/invoice-formatters.js'

describe('Invoice Generation', () => {
  let tmpDir: string
  let engine: ReceiptEngine
  let store: ReceiptStore
  let keyManager: KeyManager

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'invoice-test-'))
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']

    store = new ReceiptStore(tmpDir)
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

  async function seedReceipts() {
    await engine.track({
      action: 'summarize',
      input: 'text1',
      output: 'summary1',
      output_summary: 'Summarized document',
      cost_usd: 0.005,
      latency_ms: 200,
      model: 'gpt-4',
      tokens_in: 100,
      tokens_out: 50,
    })
    await engine.track({
      action: 'translate',
      input: 'text2',
      output: 'translation2',
      output_summary: 'Translated to French',
      cost_usd: 0.003,
      latency_ms: 150,
      model: 'gpt-4',
      tokens_in: 80,
      tokens_out: 60,
    })
    await engine.track({
      action: 'summarize',
      input: 'text3',
      output: 'summary3',
      cost_usd: 0.004,
      latency_ms: 180,
      model: 'gpt-3.5-turbo',
      tokens_in: 90,
      tokens_out: 40,
    })
  }

  const defaultOptions: InvoiceOptions = {
    from: '2000-01-01',
    to: '2099-12-31',
  }

  describe('generateInvoice', () => {
    it('generates invoice from receipts in date range', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      expect(invoice.invoice_number).toMatch(/^AR-\d{8}-[A-Z0-9]{4}$/)
      expect(invoice.summary.total_receipts).toBe(3)
      expect(invoice.groups.length).toBeGreaterThan(0)
    })

    it('returns empty invoice when no receipts in range', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, {
        from: '2090-01-01',
        to: '2090-12-31',
      })
      expect(invoice.summary.total_receipts).toBe(0)
      expect(invoice.groups[0]!.items.length).toBe(0)
    })

    it('filters by status (only completed)', async () => {
      await engine.create({
        action: 'pending_action',
        input_hash: 'sha256:xyz',
        status: 'pending',
      })
      await engine.track({
        action: 'done_action',
        input: 'data',
      })
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      expect(invoice.summary.total_receipts).toBe(1)
      expect(invoice.groups[0]!.items[0]!.action).toBe('done_action')
    })

    it('filters by agent_ids', async () => {
      await seedReceipts()
      // All receipts share the same agent from ConfigManager default
      const allResult = await store.list(undefined, 1, 100)
      const agentId = allResult.data[0]!.agent_id

      const invoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        agent_ids: [agentId],
      })
      expect(invoice.summary.total_receipts).toBe(3)

      const emptyInvoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        agent_ids: ['nonexistent-agent'],
      })
      expect(emptyInvoice.summary.total_receipts).toBe(0)
    })

    it('filters by actions', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        actions: ['summarize'],
      })
      expect(invoice.summary.total_receipts).toBe(2)
      for (const item of invoice.groups[0]!.items) {
        expect(item.action).toBe('summarize')
      }
    })

    it('filters by constraints_passed_only', async () => {
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
      await engine.track({
        action: 'no_constraint',
        input: 'data',
      })

      const invoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        constraints_passed_only: true,
      })
      // Should include pass_action and no_constraint, not fail_action
      expect(invoice.summary.total_receipts).toBe(2)
      const actions = invoice.groups[0]!.items.map((i) => i.action)
      expect(actions).toContain('pass_action')
      expect(actions).toContain('no_constraint')
      expect(actions).not.toContain('fail_action')
    })

    it('includes client and provider info', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        client: { name: 'Acme Corp', email: 'billing@acme.com' },
        provider: { name: 'AI Agency', email: 'invoices@agency.com' },
      })
      expect(invoice.client?.name).toBe('Acme Corp')
      expect(invoice.provider?.name).toBe('AI Agency')
    })

    it('includes notes and payment terms', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        notes: 'Thank you for your business',
        payment_terms: 'Net 30',
      })
      expect(invoice.notes).toBe('Thank you for your business')
      expect(invoice.payment_terms).toBe('Net 30')
    })

    it('includes public key', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      expect(invoice.public_key).toMatch(/^[a-f0-9]{64}$/)
    })

    it('sets generated_at and period', async () => {
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      expect(invoice.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(invoice.period.from).toBe('2000-01-01')
      expect(invoice.period.to).toBe('2099-12-31')
    })
  })

  describe('grouping', () => {
    it('groups by action', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        group_by: 'action',
      })
      expect(invoice.groups.length).toBe(2) // summarize + translate
      const labels = invoice.groups.map((g) => g.label).sort()
      expect(labels).toEqual(['summarize', 'translate'])
    })

    it('groups by agent', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        group_by: 'agent',
      })
      // All receipts share the same agent, so one group
      expect(invoice.groups.length).toBe(1)
      expect(invoice.groups[0]!.count).toBe(3)
    })

    it('groups by day', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        group_by: 'day',
      })
      // All created ~same time, so likely one day group
      expect(invoice.groups.length).toBeGreaterThanOrEqual(1)
      expect(invoice.groups[0]!.label).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('groups by none (single group)', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        group_by: 'none',
      })
      expect(invoice.groups.length).toBe(1)
      expect(invoice.groups[0]!.label).toBe('All Items')
      expect(invoice.groups[0]!.count).toBe(3)
    })

    it('subtotals are correct per group', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        group_by: 'action',
      })
      const summarizeGroup = invoice.groups.find((g) => g.label === 'summarize')
      expect(summarizeGroup).toBeDefined()
      expect(summarizeGroup!.subtotal_usd).toBeCloseTo(0.009, 4) // 0.005 + 0.004
      expect(summarizeGroup!.count).toBe(2)
    })
  })

  describe('line items', () => {
    it('maps receipt fields correctly', async () => {
      await engine.track({
        action: 'test_action',
        input: 'data',
        output: 'result',
        output_summary: 'Test summary',
        cost_usd: 0.01,
        latency_ms: 500,
        model: 'gpt-4',
        tokens_in: 100,
        tokens_out: 50,
      })
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      const item = invoice.groups[0]!.items[0]!
      expect(item.action).toBe('test_action')
      expect(item.description).toBe('Test summary')
      expect(item.cost_usd).toBe(0.01)
      expect(item.latency_ms).toBe(500)
      expect(item.model).toBe('gpt-4')
      expect(item.tokens_in).toBe(100)
      expect(item.tokens_out).toBe(50)
      expect(item.receipt).toBeDefined()
      expect(item.receipt.receipt_id).toMatch(/^rcpt_/)
    })

    it('uses fallback description when no output_summary', async () => {
      await engine.track({
        action: 'some_action',
        input: 'data',
      })
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      const item = invoice.groups[0]!.items[0]!
      expect(item.description).toContain('some_action')
      expect(item.description).toContain('by')
    })

    it('handles null cost gracefully', async () => {
      await engine.track({
        action: 'free_action',
        input: 'data',
      })
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      const item = invoice.groups[0]!.items[0]!
      expect(item.cost_usd).toBeNull()
    })

    it('tracks constraint status in line item', async () => {
      await engine.track({
        action: 'constrained',
        input: 'data',
        latency_ms: 100,
        constraints: [{ type: 'max_latency_ms', value: 5000 }],
      })
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      expect(invoice.groups[0]!.items[0]!.constraints_passed).toBe(true)
    })
  })

  describe('summary calculations', () => {
    it('calculates totals correctly', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      expect(invoice.summary.total_cost_usd).toBeCloseTo(0.012, 4)
      expect(invoice.summary.total_tokens_in).toBe(270)
      expect(invoice.summary.total_tokens_out).toBe(150)
      expect(invoice.summary.total_latency_ms).toBe(530)
    })

    it('calculates averages correctly', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      expect(invoice.summary.avg_cost_usd).toBeCloseTo(0.004, 3)
      expect(invoice.summary.avg_latency_ms).toBeCloseTo(176.67, 0)
    })

    it('counts constraints correctly', async () => {
      await engine.track({
        action: 'pass',
        input: 'a',
        latency_ms: 100,
        constraints: [{ type: 'max_latency_ms', value: 5000 }],
      })
      await engine.track({
        action: 'fail',
        input: 'b',
        latency_ms: 10000,
        constraints: [{ type: 'max_latency_ms', value: 5000 }],
      })
      await engine.track({
        action: 'none',
        input: 'c',
      })
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      expect(invoice.summary.constraints_evaluated).toBe(2)
      expect(invoice.summary.constraints_passed).toBe(1)
      expect(invoice.summary.constraints_failed).toBe(1)
    })

    it('handles empty invoice summary', async () => {
      const invoice = await generateInvoice(store, keyManager, {
        from: '2090-01-01',
        to: '2090-12-31',
      })
      expect(invoice.summary.total_receipts).toBe(0)
      expect(invoice.summary.total_cost_usd).toBe(0)
      expect(invoice.summary.avg_cost_usd).toBe(0)
      expect(invoice.summary.avg_latency_ms).toBe(0)
    })
  })

  describe('ReceiptEngine.generateInvoice', () => {
    it('delegates to generateInvoice function', async () => {
      await seedReceipts()
      const invoice = await engine.generateInvoice(defaultOptions)
      expect(invoice.invoice_number).toMatch(/^AR-/)
      expect(invoice.summary.total_receipts).toBe(3)
    })
  })

  describe('formatInvoiceJSON', () => {
    it('returns valid JSON without receipts', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      const json = formatInvoiceJSON(invoice, false)
      const parsed = JSON.parse(json)
      expect(parsed.invoice_number).toBe(invoice.invoice_number)
      // Should not have receipt key on items
      const firstItem = parsed.groups[0].items[0]
      expect(firstItem.receipt).toBeUndefined()
      expect(firstItem.receipt_id).toBeDefined()
    })

    it('returns valid JSON with receipts when requested', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      const json = formatInvoiceJSON(invoice, true)
      const parsed = JSON.parse(json)
      const firstItem = parsed.groups[0].items[0]
      expect(firstItem.receipt).toBeDefined()
      expect(firstItem.receipt.receipt_id).toMatch(/^rcpt_/)
    })
  })

  describe('formatInvoiceCSV', () => {
    it('contains headers and data rows', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      const csv = formatInvoiceCSV(invoice)
      const lines = csv.split('\n')
      // First line is headers
      expect(lines[0]).toContain('receipt_id')
      expect(lines[0]).toContain('action')
      expect(lines[0]).toContain('cost_usd')
      // 3 data rows
      expect(lines[1]).toContain('summarize')
      // Summary row
      expect(csv).toContain('# Invoice:')
      expect(csv).toContain('# Total Cost:')
    })

    it('handles empty invoice', async () => {
      const invoice = await generateInvoice(store, keyManager, {
        from: '2090-01-01',
        to: '2090-12-31',
      })
      const csv = formatInvoiceCSV(invoice)
      expect(csv).toContain('receipt_id')
      expect(csv).toContain('# Total Receipts: 0')
    })
  })

  describe('formatInvoiceMarkdown', () => {
    it('contains structured markdown', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        client: { name: 'Test Client' },
        provider: { name: 'Test Provider' },
        notes: 'Test note',
        payment_terms: 'Net 15',
      })
      const md = formatInvoiceMarkdown(invoice)
      expect(md).toContain(`# Invoice ${invoice.invoice_number}`)
      expect(md).toContain('## Provider')
      expect(md).toContain('Test Provider')
      expect(md).toContain('## Bill To')
      expect(md).toContain('Test Client')
      expect(md).toContain('| Receipt ID |')
      expect(md).toContain('## Summary')
      expect(md).toContain('## Notes')
      expect(md).toContain('Test note')
      expect(md).toContain('## Payment Terms')
      expect(md).toContain('Net 15')
      expect(md).toContain('## Verification')
      expect(md).toContain('Public Key')
    })

    it('omits optional sections when not provided', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      const md = formatInvoiceMarkdown(invoice)
      expect(md).not.toContain('## Provider')
      expect(md).not.toContain('## Bill To')
      expect(md).not.toContain('## Notes')
      expect(md).not.toContain('## Payment Terms')
    })
  })

  describe('formatInvoiceHTML', () => {
    it('returns self-contained HTML document', async () => {
      await seedReceipts()
      const invoice = await generateInvoice(store, keyManager, {
        ...defaultOptions,
        client: { name: 'Acme Corp' },
        provider: { name: 'AI Agency' },
      })
      const html = formatInvoiceHTML(invoice)
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html')
      expect(html).toContain('</html>')
      expect(html).toContain('<style>')
      expect(html).toContain(invoice.invoice_number)
      expect(html).toContain('Acme Corp')
      expect(html).toContain('AI Agency')
      expect(html).toContain('Verification')
      expect(html).toContain(invoice.public_key)
    })

    it('includes print media queries', async () => {
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      const html = formatInvoiceHTML(invoice)
      expect(html).toContain('@media print')
    })

    it('escapes HTML entities', async () => {
      await engine.track({
        action: 'test<script>',
        input: 'data',
        output_summary: '<b>bold</b>',
      })
      const invoice = await generateInvoice(store, keyManager, defaultOptions)
      const html = formatInvoiceHTML(invoice)
      expect(html).not.toContain('<script>')
      expect(html).toContain('&lt;script&gt;')
    })

    it('handles invoice with no items', async () => {
      const invoice = await generateInvoice(store, keyManager, {
        from: '2090-01-01',
        to: '2090-12-31',
      })
      const html = formatInvoiceHTML(invoice)
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('$0.0000')
    })
  })
})
