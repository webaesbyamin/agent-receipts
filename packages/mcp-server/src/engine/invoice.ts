import type { ActionReceipt } from '@agent-receipts/schema'
import type { ReceiptStore } from '../storage/receipt-store.js'
import type { KeyManager } from '../storage/key-manager.js'

export interface InvoiceOptions {
  from: string
  to: string
  client?: { name: string; email?: string; address?: string }
  provider?: { name: string; email?: string; address?: string }
  group_by?: 'action' | 'agent' | 'day' | 'none'
  agent_ids?: string[]
  actions?: string[]
  constraints_passed_only?: boolean
  notes?: string
  payment_terms?: string
}

export interface InvoiceLineItem {
  receipt_id: string
  action: string
  agent_id: string
  timestamp: string
  description: string
  cost_usd: number | null
  latency_ms: number | null
  model: string | null
  tokens_in: number | null
  tokens_out: number | null
  constraints_passed: boolean | null
  receipt: ActionReceipt
}

export interface InvoiceGroup {
  label: string
  items: InvoiceLineItem[]
  subtotal_usd: number
  count: number
}

export interface InvoiceSummary {
  total_receipts: number
  total_cost_usd: number
  avg_cost_usd: number
  total_tokens_in: number
  total_tokens_out: number
  total_latency_ms: number
  avg_latency_ms: number
  constraints_evaluated: number
  constraints_passed: number
  constraints_failed: number
}

export interface Invoice {
  invoice_number: string
  generated_at: string
  period: { from: string; to: string }
  client?: { name: string; email?: string; address?: string }
  provider?: { name: string; email?: string; address?: string }
  groups: InvoiceGroup[]
  summary: InvoiceSummary
  public_key: string
  notes?: string
  payment_terms?: string
}

function generateInvoiceNumber(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let suffix = ''
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)]
  }
  return `AR-${y}${m}${d}-${suffix}`
}

function receiptToLineItem(receipt: ActionReceipt): InvoiceLineItem {
  const cr = receipt.constraint_result as { passed?: boolean } | null
  return {
    receipt_id: receipt.receipt_id,
    action: receipt.action,
    agent_id: receipt.agent_id,
    timestamp: receipt.timestamp,
    description: receipt.output_summary ?? `${receipt.action} by ${receipt.agent_id}`,
    cost_usd: receipt.cost_usd,
    latency_ms: receipt.latency_ms,
    model: receipt.model,
    tokens_in: receipt.tokens_in,
    tokens_out: receipt.tokens_out,
    constraints_passed: cr && typeof cr.passed === 'boolean' ? cr.passed : null,
    receipt,
  }
}

function groupItems(
  items: InvoiceLineItem[],
  groupBy: 'action' | 'agent' | 'day' | 'none',
): InvoiceGroup[] {
  if (groupBy === 'none') {
    const subtotal = items.reduce((s, i) => s + (i.cost_usd ?? 0), 0)
    return [{ label: 'All Items', items, subtotal_usd: subtotal, count: items.length }]
  }

  const map = new Map<string, InvoiceLineItem[]>()

  for (const item of items) {
    let key: string
    if (groupBy === 'action') {
      key = item.action
    } else if (groupBy === 'agent') {
      key = item.agent_id
    } else {
      key = item.timestamp.slice(0, 10) // YYYY-MM-DD
    }
    const group = map.get(key) ?? []
    group.push(item)
    map.set(key, group)
  }

  const groups: InvoiceGroup[] = []
  for (const [label, groupItems] of map) {
    const subtotal = groupItems.reduce((s, i) => s + (i.cost_usd ?? 0), 0)
    groups.push({ label, items: groupItems, subtotal_usd: subtotal, count: groupItems.length })
  }

  return groups.sort((a, b) => a.label.localeCompare(b.label))
}

function calculateSummary(items: InvoiceLineItem[]): InvoiceSummary {
  let totalCost = 0
  let totalTokensIn = 0
  let totalTokensOut = 0
  let totalLatency = 0
  let constraintsEvaluated = 0
  let constraintsPassed = 0
  let constraintsFailed = 0

  for (const item of items) {
    totalCost += item.cost_usd ?? 0
    totalTokensIn += item.tokens_in ?? 0
    totalTokensOut += item.tokens_out ?? 0
    totalLatency += item.latency_ms ?? 0
    if (item.constraints_passed !== null) {
      constraintsEvaluated++
      if (item.constraints_passed) constraintsPassed++
      else constraintsFailed++
    }
  }

  return {
    total_receipts: items.length,
    total_cost_usd: totalCost,
    avg_cost_usd: items.length > 0 ? totalCost / items.length : 0,
    total_tokens_in: totalTokensIn,
    total_tokens_out: totalTokensOut,
    total_latency_ms: totalLatency,
    avg_latency_ms: items.length > 0 ? totalLatency / items.length : 0,
    constraints_evaluated: constraintsEvaluated,
    constraints_passed: constraintsPassed,
    constraints_failed: constraintsFailed,
  }
}

export async function generateInvoice(
  store: ReceiptStore,
  keyManager: KeyManager,
  options: InvoiceOptions,
): Promise<Invoice> {
  // Fetch all completed receipts in date range
  const result = await store.list(
    { from: options.from, to: options.to, status: 'completed' },
    1,
    100000,
    'timestamp:asc',
  )

  let receipts = result.data

  // Post-filter by agent_ids
  if (options.agent_ids && options.agent_ids.length > 0) {
    const agentSet = new Set(options.agent_ids)
    receipts = receipts.filter((r) => agentSet.has(r.agent_id))
  }

  // Post-filter by actions
  if (options.actions && options.actions.length > 0) {
    const actionSet = new Set(options.actions)
    receipts = receipts.filter((r) => actionSet.has(r.action))
  }

  // Post-filter by constraints_passed_only
  if (options.constraints_passed_only) {
    receipts = receipts.filter((r) => {
      const cr = r.constraint_result as { passed?: boolean } | null
      // Include receipts with no constraints OR passed constraints
      return !cr || cr.passed !== false
    })
  }

  const items = receipts.map(receiptToLineItem)
  const groupBy = options.group_by ?? 'none'
  const groups = groupItems(items, groupBy)
  const summary = calculateSummary(items)
  const publicKey = keyManager.getPublicKey()

  return {
    invoice_number: generateInvoiceNumber(),
    generated_at: new Date().toISOString(),
    period: { from: options.from, to: options.to },
    client: options.client,
    provider: options.provider,
    groups,
    summary,
    public_key: publicKey,
    notes: options.notes,
    payment_terms: options.payment_terms,
  }
}
