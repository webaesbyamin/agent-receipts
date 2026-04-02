import { readdir, readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import type { ActionReceipt } from '@agent-receipts/schema'
import type { ReceiptFilter, PaginatedResult } from '../types.js'

const SORTABLE_COLUMNS = new Set([
  'timestamp', 'completed_at', 'cost_usd',
  'latency_ms', 'tokens_in', 'tokens_out', 'confidence',
])

export class SqliteReceiptStore {
  private dbPath: string
  private receiptsDir: string
  private db!: Database.Database

  constructor(private dataDir: string) {
    this.dbPath = join(dataDir, 'receipts.db')
    this.receiptsDir = join(dataDir, 'receipts')
  }

  async init(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true })

    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS receipts (
        receipt_id TEXT PRIMARY KEY,
        chain_id TEXT NOT NULL,
        parent_receipt_id TEXT,
        receipt_type TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        environment TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        output_hash TEXT,
        model TEXT,
        tokens_in INTEGER,
        tokens_out INTEGER,
        cost_usd REAL,
        latency_ms INTEGER,
        confidence REAL,
        timestamp TEXT NOT NULL,
        completed_at TEXT,
        expires_at TEXT,
        tags TEXT,
        data TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_receipts_agent_id ON receipts(agent_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_chain_id ON receipts(chain_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
      CREATE INDEX IF NOT EXISTS idx_receipts_action ON receipts(action);
      CREATE INDEX IF NOT EXISTS idx_receipts_timestamp ON receipts(timestamp);
      CREATE INDEX IF NOT EXISTS idx_receipts_environment ON receipts(environment);
      CREATE INDEX IF NOT EXISTS idx_receipts_receipt_type ON receipts(receipt_type);
      CREATE INDEX IF NOT EXISTS idx_receipts_expires_at ON receipts(expires_at);
      CREATE INDEX IF NOT EXISTS idx_receipts_parent_receipt_id ON receipts(parent_receipt_id);
    `)

    await this.migrateJsonFiles()
  }

  private async migrateJsonFiles(): Promise<void> {
    let files: string[]
    try {
      files = await readdir(this.receiptsDir)
    } catch {
      return // No receipts directory — nothing to migrate
    }

    const jsonFiles = files.filter(f => f.endsWith('.json') && !f.startsWith('.'))
    if (jsonFiles.length === 0) return

    const insert = this.db.prepare(`INSERT OR IGNORE INTO receipts (
      receipt_id, chain_id, parent_receipt_id, receipt_type, agent_id, org_id,
      action, status, environment, input_hash, output_hash, model,
      tokens_in, tokens_out, cost_usd, latency_ms, confidence,
      timestamp, completed_at, expires_at, tags, data
    ) VALUES (
      @receipt_id, @chain_id, @parent_receipt_id, @receipt_type, @agent_id, @org_id,
      @action, @status, @environment, @input_hash, @output_hash, @model,
      @tokens_in, @tokens_out, @cost_usd, @latency_ms, @confidence,
      @timestamp, @completed_at, @expires_at, @tags, @data
    )`)

    let migrated = 0
    const tx = this.db.transaction(() => {
      for (const file of jsonFiles) {
        try {
          // Synchronous read for transaction performance
          const fs = require('node:fs')
          const raw = fs.readFileSync(join(this.receiptsDir, file), 'utf-8')
          const receipt = JSON.parse(raw) as ActionReceipt
          insert.run(this.toRow(receipt))
          migrated++
        } catch {
          // Skip corrupt files
        }
      }
    })
    tx()

    if (migrated > 0) {
      console.log(`Migrated ${migrated} receipts from JSON files to SQLite`)
    }
  }

  private toRow(receipt: ActionReceipt): Record<string, unknown> {
    const meta = receipt.metadata as Record<string, unknown> | undefined
    return {
      receipt_id: receipt.receipt_id,
      chain_id: receipt.chain_id,
      parent_receipt_id: receipt.parent_receipt_id,
      receipt_type: receipt.receipt_type,
      agent_id: receipt.agent_id,
      org_id: receipt.org_id,
      action: receipt.action,
      status: receipt.status,
      environment: receipt.environment,
      input_hash: receipt.input_hash,
      output_hash: receipt.output_hash,
      model: receipt.model,
      tokens_in: receipt.tokens_in,
      tokens_out: receipt.tokens_out,
      cost_usd: receipt.cost_usd,
      latency_ms: receipt.latency_ms,
      confidence: receipt.confidence,
      timestamp: receipt.timestamp,
      completed_at: receipt.completed_at,
      expires_at: meta?.expires_at as string | null ?? null,
      tags: receipt.tags ? JSON.stringify(receipt.tags) : null,
      data: JSON.stringify(receipt),
    }
  }

  async save(receipt: ActionReceipt): Promise<void> {
    const row = this.toRow(receipt)
    this.db.prepare(`INSERT OR REPLACE INTO receipts (
      receipt_id, chain_id, parent_receipt_id, receipt_type, agent_id, org_id,
      action, status, environment, input_hash, output_hash, model,
      tokens_in, tokens_out, cost_usd, latency_ms, confidence,
      timestamp, completed_at, expires_at, tags, data
    ) VALUES (
      @receipt_id, @chain_id, @parent_receipt_id, @receipt_type, @agent_id, @org_id,
      @action, @status, @environment, @input_hash, @output_hash, @model,
      @tokens_in, @tokens_out, @cost_usd, @latency_ms, @confidence,
      @timestamp, @completed_at, @expires_at, @tags, @data
    )`).run(row)
  }

  async get(receiptId: string): Promise<ActionReceipt | null> {
    const row = this.db.prepare('SELECT data FROM receipts WHERE receipt_id = ?').get(receiptId) as { data: string } | undefined
    if (!row) return null
    return JSON.parse(row.data) as ActionReceipt
  }

  async exists(receiptId: string): Promise<boolean> {
    const row = this.db.prepare('SELECT 1 FROM receipts WHERE receipt_id = ?').get(receiptId)
    return row !== undefined
  }

  async list(
    filter?: ReceiptFilter,
    page = 1,
    limit = 50,
    sort = 'timestamp:desc'
  ): Promise<PaginatedResult<ActionReceipt>> {
    const { where, params } = this.buildWhere(filter)

    // Count
    const countRow = this.db.prepare(`SELECT COUNT(*) as cnt FROM receipts ${where}`).get(...params) as { cnt: number }
    const total = countRow.cnt

    // Sort
    const [sortField, sortDir] = sort.split(':') as [string, string]
    const col = sortField === 'created_at' ? 'timestamp' : sortField
    const safeCol = SORTABLE_COLUMNS.has(col) ? col : 'timestamp'
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC'
    // Push nulls to end regardless of sort direction
    const orderClause = `ORDER BY CASE WHEN ${safeCol} IS NULL THEN 1 ELSE 0 END, ${safeCol} ${dir}`

    // Paginate
    const offset = (page - 1) * limit
    const rows = this.db.prepare(
      `SELECT data FROM receipts ${where} ${orderClause} LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as { data: string }[]

    const totalPages = Math.max(1, Math.ceil(total / limit))

    return {
      data: rows.map(r => JSON.parse(r.data) as ActionReceipt),
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
    const { where, params } = this.buildWhere(filter)
    const row = this.db.prepare(`SELECT COUNT(*) as cnt FROM receipts ${where}`).get(...params) as { cnt: number }
    return row.cnt
  }

  async delete(receiptId: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM receipts WHERE receipt_id = ?').run(receiptId)
    return result.changes > 0
  }

  async cleanup(): Promise<{ deleted: number; total: number }> {
    const now = new Date().toISOString()
    const totalRow = this.db.prepare('SELECT COUNT(*) as cnt FROM receipts').get() as { cnt: number }
    const total = totalRow.cnt

    const result = this.db.prepare(
      'DELETE FROM receipts WHERE expires_at IS NOT NULL AND expires_at < ?'
    ).run(now)

    return { deleted: result.changes, total }
  }

  private buildWhere(filter?: ReceiptFilter): { where: string; params: unknown[] } {
    if (!filter) return { where: '', params: [] }

    const conditions: string[] = []
    const params: unknown[] = []

    if (filter.agent_id) {
      conditions.push('agent_id = ?')
      params.push(filter.agent_id)
    }
    if (filter.action) {
      conditions.push('action = ?')
      params.push(filter.action)
    }
    if (filter.status) {
      conditions.push('status = ?')
      params.push(filter.status)
    }
    if (filter.environment) {
      conditions.push('environment = ?')
      params.push(filter.environment)
    }
    if (filter.receipt_type) {
      conditions.push('receipt_type = ?')
      params.push(filter.receipt_type)
    }
    if (filter.chain_id) {
      conditions.push('chain_id = ?')
      params.push(filter.chain_id)
    }
    if (filter.parent_receipt_id) {
      conditions.push('parent_receipt_id = ?')
      params.push(filter.parent_receipt_id)
    }
    if (filter.tag) {
      conditions.push('tags LIKE ?')
      params.push(`%"${filter.tag}"%`)
    }
    if (filter.from) {
      conditions.push('timestamp >= ?')
      params.push(filter.from)
    }
    if (filter.to) {
      conditions.push('timestamp <= ?')
      params.push(filter.to)
    }

    if (conditions.length === 0) return { where: '', params: [] }
    return { where: `WHERE ${conditions.join(' AND ')}`, params }
  }
}
