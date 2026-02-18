import {
  ReceiptStore,
  KeyManager,
  ConfigManager,
  ReceiptEngine,
  hashData,
} from '@agentreceipts/mcp-server'
import type {
  TrackParams,
  CreateParams,
  CompleteParams,
  ReceiptFilter,
  PaginatedResult,
} from '@agentreceipts/mcp-server'
import type { ActionReceipt } from '@agentreceipts/schema'

export interface AgentReceiptsConfig {
  dataDir?: string
}

export class AgentReceipts {
  private engine: ReceiptEngine | null = null
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
    this.initialized = true
    return this.engine
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
}

export { hashData }
export type { TrackParams, CreateParams, CompleteParams, ReceiptFilter, PaginatedResult }
