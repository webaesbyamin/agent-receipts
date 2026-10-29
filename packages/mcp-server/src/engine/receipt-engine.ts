import { nanoid } from 'nanoid'
import { ActionReceipt } from '@agent-receipts/schema'
import type { ConstraintDefinition, FileManifestEntry } from '@agent-receipts/schema'
import { signReceiptV2, verifyAnyReceipt, computeKeyId, hashReceipt } from '@agent-receipts/crypto'
import type { VerifyResult } from '@agent-receipts/crypto'
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
  /** Files hashed by the harness for this action (see hashFile). */
  files?: FileManifestEntry[]
}

export interface CreateParams {
  action: string
  input_hash: string
  receipt_type?: 'action' | 'verification' | 'judgment' | 'arbitration' | 'memory'
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
  files?: FileManifestEntry[]
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
  files?: FileManifestEntry[]
}

export interface ChainVerification {
  chain_id: string
  valid: boolean
  receipts: Array<{
    receipt_id: string
    status: string
    signature_valid: boolean
    sig_version: 1 | 2
    link_valid: boolean | null
  }>
  problems: string[]
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

    const publicKey = this.keyManager.getPublicKey()
    const status = params.status ?? 'pending'
    // Finalized receipts link to the chain's current tip; pending ones get
    // their link when complete() finalizes them.
    const prevReceiptHash = status === 'pending' ? null : await this.linkFor(chainId)

    const receiptData = {
      sig_version: 2 as const,
      key_id: computeKeyId(publicKey),
      prev_receipt_hash: prevReceiptHash,
      files: params.files ?? null,
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
      completed_at: status === 'pending' ? null : now,
      status,
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

    // Sign the receipt (v2: every field except signature + verify_url)
    receiptData.signature = signReceiptV2(receiptData, this.keyManager.getPrivateKey())

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
    const publicKey = this.keyManager.getPublicKey()
    const updated = {
      ...existing,
      sig_version: 2 as const,
      key_id: computeKeyId(publicKey),
      prev_receipt_hash: await this.linkFor(existing.chain_id),
      files: params.files ?? existing.files ?? null,
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

    // Re-sign with updated data (always as v2)
    updated.signature = signReceiptV2(updated as Record<string, unknown>, this.keyManager.getPrivateKey())

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
      files: params.files,
      _rawOutput: params.output,
    })
  }

  async verify(receiptId: string): Promise<{ verified: boolean; receipt: ActionReceipt; details: VerifyResult }> {
    const receipt = await this.store.get(receiptId)
    if (!receipt) {
      throw new Error(`Receipt not found: ${receiptId}`)
    }

    const details = verifyAnyReceipt(receipt as Record<string, unknown>, this.keyManager.getPublicKey())
    return { verified: details.valid, receipt, details }
  }

  /**
   * Check every signature in a chain and every prev_receipt_hash link.
   * Detects edited receipts, removed receipts that something links to, and
   * forks. It cannot detect removal of the newest receipt (no hash chain can
   * without an outside anchor).
   */
  async verifyChain(chainId: string): Promise<ChainVerification> {
    const receipts = await this.store.getChain(chainId)
    const publicKey = this.keyManager.getPublicKey()
    const problems: string[] = []
    const byHash = new Map<string, ActionReceipt>()
    for (const r of receipts) byHash.set(hashReceipt(r as Record<string, unknown>), r)

    const linkedFrom = new Map<string, string>()
    let genesisCount = 0
    const rows = receipts.map((r) => {
      const sig = verifyAnyReceipt(r as Record<string, unknown>, publicKey)
      if (!sig.valid) problems.push(`${r.receipt_id}: signature does not verify`)
      let linkValid: boolean | null = null
      if (r.sig_version === 2 && r.status !== 'pending') {
        const prev = r.prev_receipt_hash ?? null
        if (prev === null) {
          genesisCount++
          linkValid = true
        } else {
          linkValid = byHash.has(prev)
          if (!linkValid) problems.push(`${r.receipt_id}: links to a receipt that is missing or was changed`)
          const other = linkedFrom.get(prev)
          if (other) problems.push(`${r.receipt_id}: forks the chain (same parent as ${other})`)
          linkedFrom.set(prev, r.receipt_id)
        }
      }
      return {
        receipt_id: r.receipt_id,
        status: r.status,
        signature_valid: sig.valid,
        sig_version: sig.sig_version,
        link_valid: linkValid,
      }
    })
    if (genesisCount > 1) problems.push(`chain has ${genesisCount} starting receipts (expected 1)`)

    return { chain_id: chainId, valid: problems.length === 0, receipts: rows, problems }
  }

  private async linkFor(chainId: string): Promise<string | null> {
    const tip = await this.store.getChainTip(chainId)
    return tip ? hashReceipt(tip as Record<string, unknown>) : null
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
