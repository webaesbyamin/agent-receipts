import type { ActionReceipt } from '@agent-receipts/schema'

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true'
}

interface PaginatedResult {
  data: ActionReceipt[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

interface StoreFilter {
  agent_id?: string
  action?: string
  status?: string
  environment?: string
  receipt_type?: string
  chain_id?: string
  parent_receipt_id?: string
  tag?: string
  from?: string
  to?: string
}

export interface AppStore {
  list(filter?: StoreFilter, page?: number, limit?: number, sort?: string): Promise<PaginatedResult>
  get(receiptId: string): Promise<ActionReceipt | null>
  getChain(chainId: string): Promise<ActionReceipt[]>
  count(filter?: StoreFilter): Promise<number>
  delete(receiptId: string): Promise<boolean>
}

export interface AppKeyManager {
  getPublicKey(): string
}

export interface AppConfigManager {
  getConfig(): { agentId: string; orgId: string; environment: string }
  update(partial: Record<string, unknown>): Promise<void>
}

// Lazy singletons
let _realStore: AppStore | null = null
let _realKeyManager: AppKeyManager | null = null
let _realConfigManager: AppConfigManager | null = null
let _demoStore: AppStore & { getPublicKey(): string; getConfig(): Record<string, unknown>; update(p: Record<string, unknown>): Promise<void> } | null = null

async function getRealStore(): Promise<AppStore> {
  if (!_realStore) {
    const { getStore } = await import('./sdk-server')
    _realStore = await getStore() as unknown as AppStore
  }
  return _realStore
}

async function getRealKeyManager(): Promise<AppKeyManager> {
  if (!_realKeyManager) {
    const { getKeyManager } = await import('./sdk-server')
    _realKeyManager = await getKeyManager() as unknown as AppKeyManager
  }
  return _realKeyManager
}

async function getRealConfigManager(): Promise<AppConfigManager> {
  if (!_realConfigManager) {
    const { getConfigManager } = await import('./sdk-server')
    _realConfigManager = await getConfigManager() as unknown as AppConfigManager
  }
  return _realConfigManager
}

function getDemoStore() {
  if (!_demoStore) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { demoStore } = require('./demo-store')
    _demoStore = demoStore
  }
  return _demoStore!
}

export async function getStore(): Promise<AppStore> {
  if (isDemoMode()) return getDemoStore()
  return getRealStore()
}

export async function getKeyManager(): Promise<AppKeyManager> {
  if (isDemoMode()) {
    const store = getDemoStore()
    return { getPublicKey: () => store.getPublicKey() }
  }
  return getRealKeyManager()
}

export async function getConfigManager(): Promise<AppConfigManager> {
  if (isDemoMode()) {
    const store = getDemoStore()
    return {
      getConfig: () => store.getConfig() as { agentId: string; orgId: string; environment: string },
      update: async () => {},
    }
  }
  return getRealConfigManager()
}

export function getDataDir(): string {
  if (isDemoMode()) return '/demo'
  return process.env.AGENT_RECEIPTS_DATA_DIR ?? require('os').homedir() + '/.agent-receipts'
}
