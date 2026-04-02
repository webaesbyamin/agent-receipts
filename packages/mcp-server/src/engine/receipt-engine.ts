import { nanoid } from 'nanoid'
import { ActionReceipt, CreateReceiptInput, CompleteReceiptInput } from '@agent-receipts/schema'
import type { ConstraintDefinition } from '@agent-receipts/schema'
import { signReceipt, verifyReceipt, getSignablePayload } from '@agent-receipts/crypto'
import { SqliteReceiptStore as ReceiptStore } from '../storage/sqlite-receipt-store.js'
import { KeyManager } from '../storage/key-manager.js'
import { ConfigManager } from '../storage/config-manager.js'
import { hashData } from '../hash.js'
import { evaluateConstraints } from './constraint-evaluator.js'
import type { ReceiptFilter, PaginatedResult } from '../types.js'
import { generateInvoice } from './invoice.js'
import type { InvoiceOptions, Invoice } from './invoice.js'

export interface TrackParams {
  action: string
  input: unknown
  output?: unknown
  model?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
  latency_ms?: number
  tool_calls?: string[]
  tags?: string[]
  confidence?: number
  metadata?: Record<string, unknown>
  parent_receipt_id?: string
  chain_id?: string
  output_summary?: string
  constraints?: ConstraintDefinition[]
  expires_at?: string
  ttl_ms?: number
}

export interface CreateParams {
  action: string
  input_hash: string
  receipt_type?: 'action' | 'verification' | 'judgment' | 'arbitration'
  output_hash?: string | null
  output_summary?: string | null
  model?: string | null
  tokens_in?: number | null
  tokens_out?: number | null
  cost_usd?: number | null
  latency_ms?: number | null
  tool_calls?: string[] | null
  tags?: string[] | null
  confidence?: number | null
  metadata?: Record<string, unknown>
  parent_receipt_id?: string | null
  chain_id?: string
  status?: 'pending' | 'completed' | 'failed' | 'timeout'
  constraints?: ConstraintDefinition[]
  expires_at?: string
  ttl_ms?: number
  _rawOutput?: unknown
}

export interface CompleteParams {
  status: 'completed' | 'failed' | 'timeout'
  output_hash?: string | null
  output_summary?: string | null
  model?: string | null
  tokens_in?: number | null
  tokens_out?: number | null
  cost_usd?: number | null
  latency_ms?: number | null
  tool_calls?: string[] | null
  confidence?: number | null
  callback_verified?: boolean | null
  error?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
}

export class ReceiptEngine {
  constructor(
    private store: ReceiptStore,
    private keyManager: KeyManager,
    private configManager: ConfigManager,
  ) {}

  async create(params: CreateParams): Promise<ActionReceipt> {
    const config = this.configManager.getConfig()
    const receiptId = `rcpt_${nanoid(12)}`
    const chainId = params.chain_id ?? `chain_${nanoid(8)}`
    const now = new Date().toISOString()

    const constraintDefs = params.constraints && params.constraints.length > 0
      ? params.constraints
      : null
    const constraintsForStorage = constraintDefs
      ? { definitions: constraintDefs }
      : null

    // Calculate expires_at from ttl_ms if provided
    let expiresAt = params.expires_at
    if (!expiresAt && params.ttl_ms) {
      expiresAt = new Date(Date.now() + params.ttl_ms).toISOString()
    }

    const metadata: Record<string, unknown> = { ...(params.metadata ?? {}) }
    if (expiresAt) {
      metadata.expires_at = expiresAt
    }

    const receiptData = {
      receipt_id: receiptId,
      parent_receipt_id: params.parent_receipt_id ?? null,
      chain_id: chainId,
      receipt_type: params.receipt_type ?? 'action',
      agent_id: config.agentId,
      org_id: config.orgId,
      action: params.action,
      input_hash: params.input_hash,
      output_hash: params.output_hash ?? null,
      output_summary: params.output_summary ?? null,
      model: params.model ?? null,
      tokens_in: params.tokens_in ?? null,
      tokens_out: params.tokens_out ?? null,
      cost_usd: params.cost_usd ?? null,
      latency_ms: params.latency_ms ?? null,
      tool_calls: params.tool_calls ?? null,
      timestamp: now,
      completed_at: params.status === 'completed' ? now : null,
      status: params.status ?? 'pending',
      error: null,
      environment: config.environment,
      tags: params.tags ?? null,
      constraints: constraintsForStorage as Record<string, unknown> | null,
      constraint_result: null as Record<string, unknown> | null,
      signature: '', // placeholder — will be replaced
      verify_url: `local://verify/${receiptId}`,
      callback_verified: null,
      confidence: params.confidence ?? null,
      metadata,
    }

    // Evaluate constraints if receipt is completed and constraints are present
    if (receiptData.status === 'completed' && constraintDefs) {
      receiptData.constraint_result = evaluateConstraints(
        receiptData as unknown as ActionReceipt,
        constraintDefs,
        { rawOutput: params._rawOutput },
      )
    }

    // Sign the receipt
    const signable = getSignablePayload(receiptData)
    const signature = signReceipt(signable, this.keyManager.getPrivateKey())
    receiptData.signature = signature

    // Validate against ActionReceipt schema
    const receipt = ActionReceipt.parse(receiptData)

    // Persist
    await this.store.save(receipt)

    return receipt
  }

  async complete(receiptId: string, params: CompleteParams): Promise<ActionReceipt> {
    const existing = await this.store.get(receiptId)
    if (!existing) {
      throw new Error(`Receipt not found: ${receiptId}`)
    }

    if (existing.status !== 'pending') {
      throw new Error(`Receipt ${receiptId} is not pending (status: ${existing.status})`)
    }

    const now = new Date().toISOString()
    const updated = {
      ...existing,
      status: params.status,
      completed_at: now,
      output_hash: params.output_hash ?? existing.output_hash,
      output_summary: params.output_summary ?? existing.output_summary,
      model: params.model ?? existing.model,
      tokens_in: params.tokens_in ?? existing.tokens_in,
      tokens_out: params.tokens_out ?? existing.tokens_out,
      cost_usd: params.cost_usd ?? existing.cost_usd,
      latency_ms: params.latency_ms ?? existing.latency_ms,
      tool_calls: params.tool_calls ?? existing.tool_calls,
      confidence: params.confidence ?? existing.confidence,
      callback_verified: params.callback_verified ?? existing.callback_verified,
      error: params.error ?? existing.error,
      metadata: params.metadata ? { ...existing.metadata, ...params.metadata } : existing.metadata,
      constraint_result: existing.constraint_result,
    }

    // Evaluate constraints if present on the receipt
    const storedConstraints = existing.constraints as { definitions: ConstraintDefinition[] } | null
    const constraints = storedConstraints?.definitions ?? null
    if (Array.isArray(constraints) && constraints.length > 0) {
      updated.constraint_result = evaluateConstraints(
        updated as unknown as ActionReceipt,
        constraints,
      )
    }

    // Re-sign with updated data
    const signable = getSignablePayload(updated)
    const signature = signReceipt(signable, this.keyManager.getPrivateKey())
    updated.signature = signature

    const receipt = ActionReceipt.parse(updated)
    await this.store.save(receipt)

    return receipt
  }

  async track(params: TrackParams): Promise<ActionReceipt> {
    const inputHash = hashData(params.input)
    const outputHash = params.output !== undefined ? hashData(params.output) : null

    return this.create({
      action: params.action,
      input_hash: inputHash,
      output_hash: outputHash,
      output_summary: params.output_summary ?? null,
      model: params.model ?? null,
      tokens_in: params.tokens_in ?? null,
      tokens_out: params.tokens_out ?? null,
      cost_usd: params.cost_usd ?? null,
      latency_ms: params.latency_ms ?? null,
      tool_calls: params.tool_calls ?? null,
      tags: params.tags ?? null,
      confidence: params.confidence ?? null,
      metadata: params.metadata ?? {},
      parent_receipt_id: params.parent_receipt_id ?? null,
      chain_id: params.chain_id,
      status: 'completed',
      constraints: params.constraints,
      expires_at: params.expires_at,
      ttl_ms: params.ttl_ms,
      _rawOutput: params.output,
    })
  }

  async verify(receiptId: string): Promise<{ verified: boolean; receipt: ActionReceipt }> {
    const receipt = await this.store.get(receiptId)
    if (!receipt) {
      throw new Error(`Receipt not found: ${receiptId}`)
    }

    const signable = getSignablePayload(receipt)
    const verified = verifyReceipt(signable, receipt.signature, this.keyManager.getPublicKey())

    return { verified, receipt }
  }

  async get(receiptId: string): Promise<ActionReceipt | null> {
    return this.store.get(receiptId)
  }

  async list(
    filter?: ReceiptFilter,
    page?: number,
    limit?: number,
    sort?: string,
  ): Promise<PaginatedResult<ActionReceipt>> {
    return this.store.list(filter, page, limit, sort)
  }

  async getChain(chainId: string): Promise<ActionReceipt[]> {
    return this.store.getChain(chainId)
  }

  async getJudgments(receiptId: string): Promise<ActionReceipt[]> {
    const result = await this.store.list({
      parent_receipt_id: receiptId,
      receipt_type: 'judgment',
    })
    return result.data
  }

  async cleanup(): Promise<{ deleted: number; remaining: number }> {
    const result = await this.store.cleanup()
    return { deleted: result.deleted, remaining: result.total - result.deleted }
  }

  getPublicKey(): string {
    return this.keyManager.getPublicKey()
  }

  async generateInvoice(options: InvoiceOptions): Promise<Invoice> {
    return generateInvoice(this.store, this.keyManager, options)
  }
}
