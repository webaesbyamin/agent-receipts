import { readdir, readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { ActionReceipt } from '@agent-receipts/schema'
import type { ReceiptFilter, PaginatedResult } from '../types.js'

export class ReceiptStore {
  private receiptsDir: string

  constructor(dataDir: string) {
    this.receiptsDir = join(dataDir, 'receipts')
  }

  async init(): Promise<void> {
    await mkdir(this.receiptsDir, { recursive: true })
  }

  async save(receipt: ActionReceipt): Promise<void> {
    await this.init()
    const filePath = join(this.receiptsDir, `${receipt.receipt_id}.json`)
    const tmpPath = join(this.receiptsDir, `.tmp_${randomBytes(8).toString('hex')}.json`)
    const data = JSON.stringify(receipt, null, 2)
    await writeFile(tmpPath, data, 'utf-8')
    await rename(tmpPath, filePath)
  }

  async get(receiptId: string): Promise<ActionReceipt | null> {
    try {
      const filePath = join(this.receiptsDir, `${receiptId}.json`)
      const data = await readFile(filePath, 'utf-8')
      return JSON.parse(data) as ActionReceipt
    } catch {
      return null
    }
  }

  async exists(receiptId: string): Promise<boolean> {
    const receipt = await this.get(receiptId)
    return receipt !== null
  }

  async list(
    filter?: ReceiptFilter,
    page = 1,
    limit = 50,
    sort = 'timestamp:desc'
  ): Promise<PaginatedResult<ActionReceipt>> {
    await this.init()
    const files = await readdir(this.receiptsDir)
    const receiptFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('.'))

    let receipts: ActionReceipt[] = []
    for (const file of receiptFiles) {
      try {
        const data = await readFile(join(this.receiptsDir, file), 'utf-8')
        receipts.push(JSON.parse(data) as ActionReceipt)
      } catch {
        // Skip corrupt files
      }
    }

    // Apply filters
    if (filter) {
      receipts = receipts.filter(r => {
        if (filter.agent_id && r.agent_id !== filter.agent_id) return false
        if (filter.action && r.action !== filter.action) return false
        if (filter.status && r.status !== filter.status) return false
        if (filter.environment && r.environment !== filter.environment) return false
        if (filter.receipt_type && r.receipt_type !== filter.receipt_type) return false
        if (filter.chain_id && r.chain_id !== filter.chain_id) return false
        if (filter.tag && (!r.tags || !r.tags.includes(filter.tag))) return false
        if (filter.from && r.timestamp < filter.from) return false
        if (filter.to && r.timestamp > filter.to) return false
        return true
      })
    }

    // Sort
    const [sortField, sortDir] = sort.split(':') as [string, string]
    receipts.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortField === 'created_at' ? 'timestamp' : sortField]
      const bVal = (b as Record<string, unknown>)[sortField === 'created_at' ? 'timestamp' : sortField]
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1
      const cmp = String(aVal).localeCompare(String(bVal))
      return sortDir === 'desc' ? -cmp : cmp
    })

    // Paginate
    const total = receipts.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const start = (page - 1) * limit
    const paged = receipts.slice(start, start + limit)

    return {
      data: paged,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    }
  }

  async getChain(chainId: string): Promise<ActionReceipt[]> {
    const result = await this.list({ chain_id: chainId }, 1, 1000, 'timestamp:asc')
    return result.data
  }

  async count(filter?: ReceiptFilter): Promise<number> {
    const result = await this.list(filter, 1, 1)
    return result.pagination.total
  }

  async delete(receiptId: string): Promise<boolean> {
    try {
      const filePath = join(this.receiptsDir, `${receiptId}.json`)
      await unlink(filePath)
      return true
    } catch {
      return false
    }
  }
}
