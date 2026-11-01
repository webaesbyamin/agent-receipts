import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, copyFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyAnyReceipt } from '@agent-receipts/crypto'
import { openDatabase, isSupportedNode, unsupportedNodeMessage } from '../storage/sqlite-driver.js'
import { SqliteReceiptStore } from '../storage/sqlite-receipt-store.js'
import { MemoryStore } from '../storage/memory-store.js'

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'v0.5-better-sqlite3')

const entity = (id = 'e1') => ({ entity_id: id, entity_type: 'project' as const, name: 'P', aliases: [], scope: 'agent' as const, created_at: 'now', created_by_agent: 'a', created_by_receipt: 'r', forgotten_at: null, merged_into: null, attributes: {}, metadata: {} })
const observation = (id: string, content: string) => ({ observation_id: id, entity_id: 'e1', content, confidence: 'high' as const, source_receipt_id: 'r', source_agent_id: 'a', source_context: null, observed_at: 'now', forgotten_at: null, forgotten_by: null, superseded_by: null, expires_at: null, tags: [], metadata: {} })

describe('Node version check', () => {
  it('accepts 22.16 and later, refuses earlier', () => {
    expect(isSupportedNode('22.15.1')).toBe(false)
    expect(isSupportedNode('22.13.0')).toBe(false)
    expect(isSupportedNode('20.19.0')).toBe(false)
    expect(isSupportedNode('22.16.0')).toBe(true)
    expect(isSupportedNode('24.0.0')).toBe(true)
    expect(isSupportedNode('26.12.1')).toBe(true)
    expect(isSupportedNode(process.versions.node)).toBe(true)
  })

  it('names the version to install', () => {
    const msg = unsupportedNodeMessage('22.14.0')
    expect(msg).toContain('22.16.0')
    expect(msg).toContain('22.14.0')
    expect(msg).toContain('Node.js 24')
  })
})

describe('node:sqlite driver', () => {
  let dir: string
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'ar-driver-')) })
  afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

  it('has FTS5 with the porter tokenizer', () => {
    const db = openDatabase(join(dir, 'a.db'))
    db.exec("CREATE VIRTUAL TABLE f USING fts5(content, tokenize='porter unicode61'); INSERT INTO f VALUES ('running tests')")
    expect(db.prepare('SELECT rank FROM f WHERE f MATCH ? ORDER BY rank').all('run')).toHaveLength(1)
    db.close()
  })

  it('binds named and positional parameters, undefined as NULL', () => {
    const db = openDatabase(join(dir, 'a.db'))
    db.exec('CREATE TABLE t (a TEXT, b INTEGER)')
    db.prepare('INSERT INTO t VALUES (@a, @b)').run({ a: 'x', b: undefined })
    db.prepare('INSERT INTO t VALUES (?, ?)').run('y', 2)
    expect(db.prepare('SELECT a, b FROM t ORDER BY a').all()).toEqual([{ a: 'x', b: null }, { a: 'y', b: 2 }])
    expect(db.prepare('SELECT a FROM t WHERE a = ?').get('nope')).toBeUndefined()
    expect(db.prepare('DELETE FROM t').run().changes).toBe(2)
    db.close()
  })

  it('rolls back a failed transaction, and a failed savepoint only', () => {
    const db = openDatabase(join(dir, 'a.db'))
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
    const a = openDatabase(path)
    a.pragma('journal_mode = WAL')
    a.exec('CREATE TABLE t (a TEXT)')
    const b = openDatabase(path)
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

  it('receipt store: WAL with synchronous NORMAL, as 0.5.x had (FULL flushes every commit)', async () => {
    const store = new SqliteReceiptStore(dir)
    await store.init()
    expect(store.getDb().prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' })
    expect(store.getDb().prepare('PRAGMA synchronous').get()).toEqual({ synchronous: 1 })
    store.close()
  })

  it('receipt store: append-only and tombstones', async () => {
    const store = new SqliteReceiptStore(dir)
    await store.init()
    const base = { receipt_id: 'r1', chain_id: 'c1', status: 'completed', receipt_type: 'action', agent_id: 'a', org_id: 'o', action: 'x', environment: 'test', input_hash: 'h', timestamp: '2020-01-01T00:00:00Z', metadata: { expires_at: '2020-01-02T00:00:00Z' } }
    await store.save(base as never)
    await expect(store.save({ ...base, action: 'edited' } as never)).rejects.toThrow('RECEIPT_IMMUTABLE')
    expect((await store.cleanup()).deleted).toBe(1)
    expect(store.getTombstoneHashes('c1').size).toBe(1)
    store.close()
  })
})

describe('memory search', () => {
  let dir: string
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'ar-fts-')) })
  afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

  it('starts from the FTS index and stays fast at 2,000 matching rows', () => {
    const db = openDatabase(join(dir, 'a.db'))
    const mem = new MemoryStore(db)
    mem.init()
    mem.createEntity(entity())
    db.transaction(() => { for (let i = 0; i < 2000; i++) mem.addObservation(observation(`o${i}`, `deploy note ${i}`)) })

    // The plan must scan the FTS match first, then look observations up by rowid.
    // The slow plan (seen on SQLite 3.51.3) scans observations and runs the match per row.
    const plan = (db.prepare(`EXPLAIN QUERY PLAN SELECT o.*, observations_fts.rank FROM observations_fts CROSS JOIN observations o ON o.rowid = observations_fts.rowid
      WHERE observations_fts MATCH ? AND o.forgotten_at IS NULL AND (o.expires_at IS NULL OR o.expires_at > datetime('now')) ORDER BY rank LIMIT ?`).all('deploy', 20) as Array<{ detail: string }>).map((r) => r.detail)
    expect(plan[0]).toMatch(/^SCAN observations_fts/)
    expect(plan[1]).toMatch(/^SEARCH o USING INTEGER PRIMARY KEY/)

    mem.search('deploy') // warm up
    const t = performance.now()
    for (let i = 0; i < 10; i++) expect(mem.search('deploy')).toHaveLength(20)
    const perSearch = (performance.now() - t) / 10
    // About 1 ms on a laptop; the slow plan took about 250 ms. Generous for CI.
    expect(perSearch).toBeLessThan(50)
    db.close()
  })
})

describe('a database written by 0.5.x on better-sqlite3', () => {
  it('opens on node:sqlite with its receipts, chain and FTS index intact', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ar-upgrade-'))
    try {
      await copyFile(join(FIXTURE, 'receipts.db'), join(dir, 'receipts.db'))
      const publicKey = (await readFile(join(FIXTURE, 'public.key'), 'utf-8')).trim()
      const store = new SqliteReceiptStore(dir)
      await store.init()
      const chain = await store.getChain('chain_fixture')
      expect(chain.map((r) => r.action)).toEqual(['fixture.one', 'fixture.two'])
      for (const r of chain) expect(verifyAnyReceipt(r as unknown as Record<string, unknown>, publicKey, { requireV2: true }).valid).toBe(true)

      const mem = new MemoryStore(store.getDb())
      mem.init()
      expect(mem.search('deploy').map((r) => r.observation.observation_id)).toEqual(['o1'])
      mem.addObservation({ ...observation('o2', 'deploys need approval'), source_receipt_id: chain[0]!.receipt_id })
      expect(mem.search('deploy')).toHaveLength(2)
      store.getDb().exec("INSERT INTO observations_fts(observations_fts) VALUES('integrity-check')")
      store.close()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
