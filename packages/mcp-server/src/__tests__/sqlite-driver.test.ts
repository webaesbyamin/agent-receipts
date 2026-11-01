import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase, resolveDriver, type SqliteDriver } from '../storage/sqlite-driver.js'
import { SqliteReceiptStore } from '../storage/sqlite-receipt-store.js'
import { MemoryStore } from '../storage/memory-store.js'

// better-sqlite3's native build only loads on the Node it was built for; run what this Node can load
const loads = (d: SqliteDriver) => { try { openDatabase(':memory:', d).close(); return true } catch { return false } }
const DRIVERS = (['better-sqlite3', 'node:sqlite'] as SqliteDriver[]).filter(loads)

describe('resolveDriver', () => {
  it('follows AGENT_RECEIPTS_SQLITE', () => {
    const want = process.env.AGENT_RECEIPTS_SQLITE === 'node' ? 'node:sqlite' : 'better-sqlite3'
    expect(resolveDriver()).toBe(want)
  })
})

describe.each(DRIVERS)('%s', (driver) => {
  let dir: string
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'ar-driver-')) })
  afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

  it('has FTS5 with the porter tokenizer', () => {
    const db = openDatabase(join(dir, 'a.db'), driver)
    db.exec("CREATE VIRTUAL TABLE f USING fts5(content, tokenize='porter unicode61'); INSERT INTO f VALUES ('running tests')")
    expect(db.prepare('SELECT rank FROM f WHERE f MATCH ? ORDER BY rank').all('run')).toHaveLength(1)
    db.close()
  })

  it('binds named and positional parameters, undefined as NULL', () => {
    const db = openDatabase(join(dir, 'a.db'), driver)
    db.exec('CREATE TABLE t (a TEXT, b INTEGER)')
    db.prepare('INSERT INTO t VALUES (@a, @b)').run({ a: 'x', b: undefined })
    db.prepare('INSERT INTO t VALUES (?, ?)').run('y', 2)
    expect(db.prepare('SELECT a, b FROM t ORDER BY a').all()).toEqual([{ a: 'x', b: null }, { a: 'y', b: 2 }])
    expect(db.prepare('SELECT a FROM t WHERE a = ?').get('nope')).toBeUndefined()
    expect(db.prepare('DELETE FROM t').run().changes).toBe(2)
    db.close()
  })

  it('rolls back a failed transaction, and a failed savepoint only', () => {
    const db = openDatabase(join(dir, 'a.db'), driver)
    db.exec('CREATE TABLE t (a TEXT)')
    expect(() => db.transaction(() => { db.prepare('INSERT INTO t VALUES (?)').run('gone'); throw new Error('boom') })).toThrow('boom')
    db.transaction(() => {
      db.prepare('INSERT INTO t VALUES (?)').run('kept')
      expect(() => db.transaction(() => { db.prepare('INSERT INTO t VALUES (?)').run('inner'); throw new Error('x') })).toThrow('x')
    })
    expect(db.prepare('SELECT a FROM t').all()).toEqual([{ a: 'kept' }])
    db.close()
    expect(db.open).toBe(false)
    db.close() // closing twice is fine
  })

  it('IMMEDIATE takes the write lock up front: a second connection cannot write meanwhile', () => {
    const path = join(dir, 'a.db')
    const a = openDatabase(path, driver)
    a.pragma('journal_mode = WAL')
    a.exec('CREATE TABLE t (a TEXT)')
    const b = openDatabase(path, driver)
    b.pragma('busy_timeout = 50')
    a.transaction(() => {
      a.prepare('SELECT count(*) FROM t').get() // a read, but the lock is already held
      expect(() => b.transaction(() => b.prepare('INSERT INTO t VALUES (?)').run('b'), 'immediate')).toThrow(/locked|busy/i)
      a.prepare('INSERT INTO t VALUES (?)').run('a')
    }, 'immediate')
    b.transaction(() => b.prepare('INSERT INTO t VALUES (?)').run('b'), 'immediate')
    expect(a.prepare('SELECT a FROM t ORDER BY rowid').all()).toEqual([{ a: 'a' }, { a: 'b' }])
    a.close(); b.close()
  })

  it('receipt store: append-only, tombstones, and FTS memory search', async () => {
    const prev = process.env.AGENT_RECEIPTS_SQLITE
    process.env.AGENT_RECEIPTS_SQLITE = driver === 'node:sqlite' ? 'node' : 'better-sqlite3'
    try {
      const store = new SqliteReceiptStore(dir)
      await store.init()
      expect(store.getDb().driver).toBe(driver)
      const base = { receipt_id: 'r1', chain_id: 'c1', status: 'completed', receipt_type: 'action', agent_id: 'a', org_id: 'o', action: 'x', environment: 'test', input_hash: 'h', timestamp: '2020-01-01T00:00:00Z', metadata: { expires_at: '2020-01-02T00:00:00Z' } }
      await store.save(base as never)
      await expect(store.save({ ...base, action: 'edited' } as never)).rejects.toThrow('RECEIPT_IMMUTABLE')
      expect((await store.cleanup()).deleted).toBe(1)
      expect(store.getTombstoneHashes('c1').size).toBe(1)

      const mem = new MemoryStore(store.getDb())
      mem.init()
      mem.createEntity({ entity_id: 'e1', entity_type: 'person', name: 'Ada', aliases: [], scope: 'agent', created_at: 'now', created_by_agent: 'a', created_by_receipt: 'r', forgotten_at: null, merged_into: null, attributes: {}, metadata: {} })
      mem.addObservation({ observation_id: 'o1', entity_id: 'e1', content: 'Ada is running the release', confidence: 'high', source_receipt_id: 'r', source_agent_id: 'a', source_context: null, observed_at: 'now', forgotten_at: null, forgotten_by: null, superseded_by: null, expires_at: null, tags: [], metadata: {} })
      expect(mem.search('runs').map((r) => r.observation.observation_id)).toEqual(['o1'])
      store.close()
    } finally {
      process.env.AGENT_RECEIPTS_SQLITE = prev
    }
  })
})

describe.runIf(DRIVERS.length === 2)('switching drivers on an existing database', () => {
  it('node:sqlite opens a better-sqlite3 database, FTS index included, and back', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ar-driver-'))
    try {
      const path = join(dir, 'receipts.db')
      const a = openDatabase(path, 'better-sqlite3')
      a.pragma('journal_mode = WAL')
      const memA = new MemoryStore(a)
      memA.init()
      memA.createEntity({ entity_id: 'e1', entity_type: 'person', name: 'Ada', aliases: [], scope: 'agent', created_at: 'now', created_by_agent: 'a', created_by_receipt: 'r', forgotten_at: null, merged_into: null, attributes: {}, metadata: {} })
      memA.addObservation({ observation_id: 'o1', entity_id: 'e1', content: 'deploys on fridays', confidence: 'high', source_receipt_id: 'r', source_agent_id: 'a', source_context: null, observed_at: 'now', forgotten_at: null, forgotten_by: null, superseded_by: null, expires_at: null, tags: [], metadata: {} })
      a.close()

      const b = openDatabase(path, 'node:sqlite')
      const memB = new MemoryStore(b)
      memB.init()
      expect(memB.search('deploy').map((r) => r.observation.observation_id)).toEqual(['o1'])
      memB.addObservation({ observation_id: 'o2', entity_id: 'e1', content: 'deploys need approval', confidence: 'high', source_receipt_id: 'r', source_agent_id: 'a', source_context: null, observed_at: 'now', forgotten_at: null, forgotten_by: null, superseded_by: null, expires_at: null, tags: [], metadata: {} })
      expect(b.prepare("INSERT INTO observations_fts(observations_fts) VALUES('integrity-check')").run().changes).toBeGreaterThanOrEqual(0)
      b.close()

      const c = openDatabase(path, 'better-sqlite3')
      expect(new MemoryStore(c).search('deploy')).toHaveLength(2)
      c.close()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
