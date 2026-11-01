import Database from 'better-sqlite3'

/**
 * The small slice of SQLite the stores use, so they can run on either
 * better-sqlite3 or Node's built-in node:sqlite. Pick one with
 * AGENT_RECEIPTS_SQLITE=node|better-sqlite3 (default: better-sqlite3).
 */
export type SqliteDriver = 'better-sqlite3' | 'node:sqlite'

export interface SqlStatement {
  run(...params: unknown[]): { changes: number }
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

export interface SqlDatabase {
  readonly driver: SqliteDriver
  readonly open: boolean
  exec(sql: string): void
  prepare(sql: string): SqlStatement
  /** Run a PRAGMA, e.g. `pragma('journal_mode = WAL')`. */
  pragma(statement: string): void
  /**
   * Run `fn` in a transaction and return its result; roll back if it throws.
   * `immediate` takes the write lock up front (BEGIN IMMEDIATE), so a
   * read-then-write can't race another connection. Nested calls use savepoints.
   */
  transaction<T>(fn: () => T, mode?: 'deferred' | 'immediate'): T
  close(): void
}

export function resolveDriver(): SqliteDriver {
  const v = process.env.AGENT_RECEIPTS_SQLITE
  return v === 'node' || v === 'node:sqlite' ? 'node:sqlite' : 'better-sqlite3'
}

export function openDatabase(path: string, driver: SqliteDriver = resolveDriver()): SqlDatabase {
  return driver === 'node:sqlite' ? new NodeSqliteDatabase(path) : new BetterSqliteDatabase(path)
}

// better-sqlite3 binds undefined as NULL; node:sqlite refuses it. Normalize for both.
function bindable(params: unknown[]): unknown[] {
  return params.map((p) => {
    if (p === undefined) return null
    if (p && typeof p === 'object' && !ArrayBuffer.isView(p)) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(p)) out[k] = v === undefined ? null : v
      return out
    }
    return p
  })
}

class BetterSqliteDatabase implements SqlDatabase {
  readonly driver = 'better-sqlite3' as const
  private db: Database.Database
  constructor(path: string) { this.db = new Database(path) }
  get open() { return this.db.open }
  exec(sql: string) { this.db.exec(sql) }
  prepare(sql: string): SqlStatement {
    const s = this.db.prepare(sql)
    return {
      run: (...p) => ({ changes: s.run(...bindable(p)).changes }),
      get: (...p) => s.get(...bindable(p)),
      all: (...p) => s.all(...bindable(p)),
    }
  }
  pragma(statement: string) { this.db.pragma(statement) }
  transaction<T>(fn: () => T, mode: 'deferred' | 'immediate' = 'deferred'): T {
    const tx = this.db.transaction(fn)
    return mode === 'immediate' ? tx.immediate() : tx()
  }
  close() { if (this.db.open) this.db.close() }
}

interface NodeStatement {
  run(...p: unknown[]): { changes: number | bigint }
  get(...p: unknown[]): unknown
  all(...p: unknown[]): unknown[]
}
interface NodeDatabaseSync {
  readonly isOpen?: boolean
  exec(sql: string): void
  prepare(sql: string): NodeStatement
  close(): void
}
interface NodeSqliteModule { DatabaseSync: new (path: string) => NodeDatabaseSync }

let nodeSqlite: NodeSqliteModule | undefined

/**
 * Load node:sqlite. Node 22 (and 24 before 24.15) prints "ExperimentalWarning:
 * SQLite is an experimental feature" on first load; drop only that warning.
 * getBuiltinModule keeps bundlers (tsup, Next, Vite) from trying to resolve it.
 */
function loadNodeSqlite(): NodeSqliteModule {
  if (nodeSqlite) return nodeSqlite
  const emit = process.emitWarning
  process.emitWarning = function (this: unknown, warning: string | Error, ...rest: unknown[]) {
    const first = rest[0] as string | { type?: string } | undefined
    const type = typeof first === 'string' ? first : first?.type
    const message = typeof warning === 'string' ? warning : warning.message
    if (type === 'ExperimentalWarning' && message.includes('SQLite')) return
    return (emit as (...a: unknown[]) => void).call(process, warning, ...rest)
  } as typeof process.emitWarning
  try {
    const mod = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule?.('node:sqlite')
    if (!mod) throw new Error(`node:sqlite is not available in Node ${process.version}`)
    nodeSqlite = mod as NodeSqliteModule
  } finally {
    process.emitWarning = emit
  }
  return nodeSqlite
}

class NodeSqliteDatabase implements SqlDatabase {
  readonly driver = 'node:sqlite' as const
  private db: NodeDatabaseSync
  private isOpenFlag = true
  private depth = 0
  constructor(path: string) {
    this.db = new (loadNodeSqlite().DatabaseSync)(path)
    // better-sqlite3 waits up to 5 s for a lock held by another connection; match it.
    this.db.exec('PRAGMA busy_timeout = 5000')
  }
  get open() { return this.isOpenFlag }
  exec(sql: string) { this.db.exec(sql) }
  prepare(sql: string): SqlStatement {
    const s = this.db.prepare(sql)
    return {
      run: (...p) => ({ changes: Number(s.run(...bindable(p)).changes) }),
      get: (...p) => s.get(...bindable(p)),
      all: (...p) => s.all(...bindable(p)),
    }
  }
  pragma(statement: string) { this.db.exec(`PRAGMA ${statement}`) }
  transaction<T>(fn: () => T, mode: 'deferred' | 'immediate' = 'deferred'): T {
    const sp = `sp_${this.depth}`
    this.db.exec(this.depth === 0 ? (mode === 'immediate' ? 'BEGIN IMMEDIATE' : 'BEGIN') : `SAVEPOINT ${sp}`)
    this.depth++
    try {
      const result = fn()
      this.depth--
      this.db.exec(this.depth === 0 ? 'COMMIT' : `RELEASE ${sp}`)
      return result
    } catch (err) {
      this.depth--
      this.db.exec(this.depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`)
      throw err
    }
  }
  close() {
    if (!this.isOpenFlag) return
    this.db.close()
    this.isOpenFlag = false
  }
}
