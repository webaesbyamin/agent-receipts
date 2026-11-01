/**
 * The small slice of SQLite the stores use, on Node's built-in node:sqlite.
 * Node 22.16 is the first 22.x whose SQLite has FTS5 (memory search needs it).
 */

export const MIN_NODE = '22.16.0'

export interface SqlStatement {
  run(...params: unknown[]): { changes: number }
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

export interface SqlDatabase {
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

/** Whether this Node can run Agent Receipts (node:sqlite with FTS5). */
export function isSupportedNode(version = process.versions.node): boolean {
  const [major = 0, minor = 0] = version.split('.').map(Number)
  return major > 22 || (major === 22 && minor >= 16)
}

export function unsupportedNodeMessage(version = process.versions.node): string {
  return `Agent Receipts needs Node.js ${MIN_NODE} or later, and this is Node.js ${version}. ` +
    'Install Node.js 24 LTS from https://nodejs.org (or with your version manager, e.g. `nvm install 24`), then run this again.'
}

/** Stop with a clear message on a Node that is too old. For CLI entry points. */
export function assertSupportedNode(): void {
  if (isSupportedNode()) return
  console.error(unsupportedNodeMessage())
  process.exit(1)
}

export function openDatabase(path: string): SqlDatabase {
  return new NodeSqliteDatabase(path)
}

// node:sqlite refuses to bind undefined; bind it as NULL, as the stores expect.
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

interface NodeStatement {
  run(...p: unknown[]): { changes: number | bigint }
  get(...p: unknown[]): unknown
  all(...p: unknown[]): unknown[]
}
interface NodeDatabaseSync {
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
  if (!isSupportedNode()) throw new Error(unsupportedNodeMessage())
  const emit = process.emitWarning
  process.emitWarning = function (this: unknown, warning: string | Error, ...rest: unknown[]) {
    const first = rest[0] as string | { type?: string } | undefined
    const type = typeof first === 'string' ? first : first?.type
    const message = typeof warning === 'string' ? warning : warning.message
    if (type === 'ExperimentalWarning' && message.includes('SQLite')) return
    return (emit as (...a: unknown[]) => void).call(process, warning, ...rest)
  } as typeof process.emitWarning
  try {
    nodeSqlite = (process as unknown as { getBuiltinModule(id: string): unknown }).getBuiltinModule('node:sqlite') as NodeSqliteModule
  } finally {
    process.emitWarning = emit
  }
  return nodeSqlite
}

class NodeSqliteDatabase implements SqlDatabase {
  private db: NodeDatabaseSync
  private isOpen = true
  private depth = 0
  constructor(path: string) {
    this.db = new (loadNodeSqlite().DatabaseSync)(path)
    // Wait up to 5 s for a lock held by another connection (e.g. a concurrent hook)
    this.db.exec('PRAGMA busy_timeout = 5000')
  }
  get open() { return this.isOpen }
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
    if (!this.isOpen) return
    this.db.close()
    this.isOpen = false
  }
}
