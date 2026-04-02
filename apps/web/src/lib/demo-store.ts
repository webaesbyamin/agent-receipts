import { DEMO_RECEIPTS, DEMO_PUBLIC_KEY, DEMO_CONFIG } from './demo-data'
import type { ActionReceipt } from '@agent-receipts/schema'

interface PaginatedResult<T> {
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

interface DemoFilter {
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

export class DemoStore {
  private receipts = DEMO_RECEIPTS

  async list(
    filter?: DemoFilter,
    page = 1,
    limit = 50,
    sort = 'timestamp:desc'
  ): Promise<PaginatedResult<ActionReceipt>> {
    let filtered = [...this.receipts]

    if (filter) {
      if (filter.agent_id) filtered = filtered.filter(r => r.agent_id === filter.agent_id)
      if (filter.action) filtered = filtered.filter(r => r.action === filter.action)
      if (filter.status) filtered = filtered.filter(r => r.status === filter.status)
      if (filter.environment) filtered = filtered.filter(r => r.environment === filter.environment)
      if (filter.receipt_type) filtered = filtered.filter(r => r.receipt_type === filter.receipt_type)
      if (filter.chain_id) filtered = filtered.filter(r => r.chain_id === filter.chain_id)
      if (filter.parent_receipt_id) filtered = filtered.filter(r => r.parent_receipt_id === filter.parent_receipt_id)
      if (filter.tag) filtered = filtered.filter(r => r.tags?.includes(filter.tag!))
      if (filter.from) filtered = filtered.filter(r => r.timestamp >= filter.from!)
      if (filter.to) filtered = filtered.filter(r => r.timestamp <= filter.to!)
    }

    const [sortField, sortDir] = sort.split(':')
    const col = sortField === 'created_at' ? 'timestamp' : sortField!
    filtered.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[col] ?? ''
      const bVal = (b as Record<string, unknown>)[col] ?? ''
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })

    const total = filtered.length
    const total_pages = Math.max(1, Math.ceil(total / limit))
    const offset = (page - 1) * limit
    const data = filtered.slice(offset, offset + limit)

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        total_pages,
        has_next: page < total_pages,
        has_prev: page > 1,
      },
    }
  }

  async get(receiptId: string): Promise<ActionReceipt | null> {
    return this.receipts.find(r => r.receipt_id === receiptId) ?? null
  }

  async exists(receiptId: string): Promise<boolean> {
    return this.receipts.some(r => r.receipt_id === receiptId)
  }

  async getChain(chainId: string): Promise<ActionReceipt[]> {
    return this.receipts
      .filter(r => r.chain_id === chainId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }

  async count(filter?: DemoFilter): Promise<number> {
    if (!filter) return this.receipts.length
    const result = await this.list(filter, 1, 1)
    return result.pagination.total
  }

  async delete(_receiptId: string): Promise<boolean> {
    return false // Demo mode: no-op
  }

  async cleanup(): Promise<{ deleted: number; total: number }> {
    return { deleted: 0, total: this.receipts.length } // Demo mode: no-op
  }

  getPublicKey(): string {
    return DEMO_PUBLIC_KEY
  }

  getConfig() {
    return { ...DEMO_CONFIG }
  }

  async update(_partial: Record<string, unknown>): Promise<void> {
    // Demo mode: no-op
  }
}

export const demoStore = new DemoStore()
