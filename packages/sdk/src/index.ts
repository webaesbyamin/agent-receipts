import {
  ReceiptStore,
  KeyManager,
  ConfigManager,
  ReceiptEngine,
  MemoryStore,
  MemoryEngine,
  hashData,
  formatInvoiceJSON,
  formatInvoiceCSV,
  formatInvoiceMarkdown,
  formatInvoiceHTML,
} from '@agent-receipts/mcp-server'
import type {
  TrackParams,
  CreateParams,
  CompleteParams,
  ReceiptFilter,
  PaginatedResult,
  InvoiceOptions,
  Invoice,
  ObserveParams,
  ObserveResult,
  RecallParams,
  RecallResult,
  ForgetParams,
  RelateParams,
  AuditParams,
  AuditReport,
} from '@agent-receipts/mcp-server'
import type { ActionReceipt, Entity, Relationship, MemoryQuery } from '@agent-receipts/schema'
import type { ProvenanceChain } from '@agent-receipts/mcp-server'

export interface AgentReceiptsConfig {
  dataDir?: string
}

export class AgentReceipts {
  private engine: ReceiptEngine | null = null
  private memoryEngine: MemoryEngine | null = null
  private memoryStore: MemoryStore | null = null
  private dataDir: string
  private initialized = false

  constructor(config?: AgentReceiptsConfig) {
    this.dataDir = config?.dataDir ?? ConfigManager.getDefaultDataDir()
  }

  private async ensureInitialized(): Promise<ReceiptEngine> {
    if (this.engine && this.initialized) {
      return this.engine
    }

    const store = new ReceiptStore(this.dataDir)
    await store.init()

    const keyManager = new KeyManager(this.dataDir)
    await keyManager.init()

    const configManager = new ConfigManager(this.dataDir)
    await configManager.init()

    this.engine = new ReceiptEngine(store, keyManager, configManager)

    // Initialize memory
    this.memoryStore = new MemoryStore(store.getDb())
    this.memoryStore.init()
    this.memoryEngine = new MemoryEngine(this.engine, this.memoryStore)

    this.initialized = true
    return this.engine
  }

  private async ensureMemory(): Promise<MemoryEngine> {
    await this.ensureInitialized()
    return this.memoryEngine!
  }

  async track(params: TrackParams): Promise<ActionReceipt> {
    const engine = await this.ensureInitialized()
    return engine.track(params)
  }

  /** Alias for track */
  async emit(params: TrackParams): Promise<ActionReceipt> {
    return this.track(params)
  }

  async start(params: CreateParams): Promise<ActionReceipt> {
    const engine = await this.ensureInitialized()
    return engine.create({ ...params, status: 'pending' })
  }

  async complete(receiptId: string, params: CompleteParams): Promise<ActionReceipt> {
    const engine = await this.ensureInitialized()
    return engine.complete(receiptId, params)
  }

  async verify(receiptId: string): Promise<{ verified: boolean; receipt: ActionReceipt }> {
    const engine = await this.ensureInitialized()
    return engine.verify(receiptId)
  }

  async get(receiptId: string): Promise<ActionReceipt | null> {
    const engine = await this.ensureInitialized()
    return engine.get(receiptId)
  }

  async list(filter?: ReceiptFilter): Promise<PaginatedResult<ActionReceipt>> {
    const engine = await this.ensureInitialized()
    return engine.list(filter)
  }

  async getPublicKey(): Promise<string> {
    const engine = await this.ensureInitialized()
    return engine.getPublicKey()
  }

  async getJudgments(receiptId: string): Promise<ActionReceipt[]> {
    const engine = await this.ensureInitialized()
    return engine.getJudgments(receiptId)
  }

  async cleanup(): Promise<{ deleted: number; remaining: number }> {
    const engine = await this.ensureInitialized()
    return engine.cleanup()
  }

  async generateInvoice(options: InvoiceOptions): Promise<Invoice> {
    const engine = await this.ensureInitialized()
    return engine.generateInvoice(options)
  }

  // --- Memory Methods ---

  async observe(params: ObserveParams): Promise<ObserveResult> {
    const mem = await this.ensureMemory()
    return mem.observe(params)
  }

  async recall(params?: RecallParams): Promise<RecallResult> {
    const mem = await this.ensureMemory()
    return mem.recall(params ?? { agentId: 'sdk' })
  }

  async forget(params: ForgetParams): Promise<{ receipt: ActionReceipt }> {
    const mem = await this.ensureMemory()
    return mem.forget(params)
  }

  async entities(filters?: Partial<MemoryQuery>): Promise<PaginatedResult<Entity>> {
    await this.ensureInitialized()
    return this.memoryStore!.findEntities({
      ...filters,
      include_forgotten: filters?.include_forgotten ?? false,
      limit: filters?.limit ?? 20,
      page: filters?.page ?? 1,
    })
  }

  async relate(params: RelateParams): Promise<{ relationship: Relationship; receipt: ActionReceipt }> {
    const mem = await this.ensureMemory()
    return mem.relate(params)
  }

  async provenance(observationId: string): Promise<ProvenanceChain | null> {
    const mem = await this.ensureMemory()
    return mem.provenance(observationId)
  }

  async memoryAudit(params?: AuditParams): Promise<AuditReport> {
    const mem = await this.ensureMemory()
    return mem.memoryAudit(params ?? {})
  }
}

export { hashData, formatInvoiceJSON, formatInvoiceCSV, formatInvoiceMarkdown, formatInvoiceHTML }
export type {
  TrackParams, CreateParams, CompleteParams, ReceiptFilter, PaginatedResult, InvoiceOptions, Invoice,
  ObserveParams, ObserveResult, RecallParams, RecallResult, ForgetParams, RelateParams, AuditParams, AuditReport,
}
