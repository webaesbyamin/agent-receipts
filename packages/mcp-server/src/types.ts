import type { ReceiptStatus, ReceiptType, Environment } from '@agent-receipts/schema'

export interface StorageConfig {
  dataDir: string
}

export interface AppConfig {
  agentId: string
  orgId: string
  environment: Environment
}

export interface ReceiptFilter {
  agent_id?: string
  action?: string
  status?: ReceiptStatus
  environment?: Environment
  receipt_type?: ReceiptType
  chain_id?: string
  tag?: string
  from?: string
  to?: string
}

export interface PaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}
