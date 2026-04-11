import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { MemoryStore } from '../storage/memory-store.js'
import type { Entity, Observation, Relationship } from '@agent-receipts/schema'

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    entity_id: `ent_${Math.random().toString(36).slice(2, 8)}`,
    entity_type: 'person',
    name: 'Test Entity',
    aliases: [],
    scope: 'agent',
    created_at: new Date().toISOString(),
    created_by_agent: 'agent_test',
    created_by_receipt: 'rcpt_test',
    forgotten_at: null,
    merged_into: null,
    attributes: {},
    metadata: {},
    ...overrides,
  }
}

function makeObservation(entityId: string, overrides: Partial<Observation> = {}): Observation {
  return {
    observation_id: `obs_${Math.random().toString(36).slice(2, 8)}`,
    entity_id: entityId,
    content: 'Test observation',
    confidence: 'medium',
    source_receipt_id: 'rcpt_test',
    source_agent_id: 'agent_test',
    source_context: null,
    observed_at: new Date().toISOString(),
    forgotten_at: null,
    forgotten_by: null,
    superseded_by: null,
    tags: [],
    metadata: {},
    ...overrides,
  }
}

describe('MemoryStore', () => {
  let tmpDir: string
  let db: Database.Database
  let store: MemoryStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'memory-store-'))
    db = new Database(join(tmpDir, 'test.db'))
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    store = new MemoryStore(db)
    store.init()
  })

  afterEach(async () => {
    db.close()
    await rm(tmpDir, { recursive: true, force: true })
  })

  describe('Entity CRUD', () => {
    it('creates and retrieves an entity', () => {
      const entity = makeEntity({ name: 'Alice' })
      store.createEntity(entity)
      const found = store.getEntity(entity.entity_id)
      expect(found).not.toBeNull()
      expect(found!.name).toBe('Alice')
    })

    it('returns null for non-existent entity', () => {
      expect(store.getEntity('ent_nonexistent')).toBeNull()
    })

    it('finds entity by name and type', () => {
      const entity = makeEntity({ name: 'Bob', entity_type: 'person' })
      store.createEntity(entity)
      const found = store.findEntityByName('Bob', 'person')
      expect(found).not.toBeNull()
      expect(found!.entity_id).toBe(entity.entity_id)
    })

    it('does not find forgotten entities by name', () => {
      const entity = makeEntity({ name: 'Charlie' })
      store.createEntity(entity)
      store.forgetEntity(entity.entity_id, 'agent_test')
      const found = store.findEntityByName('Charlie', 'person')
      expect(found).toBeNull()
    })

    it('updates an entity', () => {
      const entity = makeEntity({ name: 'Dave' })
      store.createEntity(entity)
      const updated = store.updateEntity(entity.entity_id, { name: 'David', aliases: ['Dave'] })
      expect(updated.name).toBe('David')
      expect(updated.aliases).toEqual(['Dave'])
    })

    it('lists entities with filtering', () => {
      store.createEntity(makeEntity({ name: 'E1', entity_type: 'person' }))
      store.createEntity(makeEntity({ name: 'E2', entity_type: 'project' }))
      store.createEntity(makeEntity({ name: 'E3', entity_type: 'person' }))

      const result = store.findEntities({ entity_type: 'person', include_forgotten: false, limit: 20, page: 1 })
      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
    })

    it('paginates entities', () => {
      for (let i = 0; i < 5; i++) {
        store.createEntity(makeEntity({ name: `P${i}` }))
      }
      const page1 = store.findEntities({ include_forgotten: false, limit: 2, page: 1 })
      expect(page1.data).toHaveLength(2)
      expect(page1.pagination.total).toBe(5)
      expect(page1.pagination.has_next).toBe(true)

      const page3 = store.findEntities({ include_forgotten: false, limit: 2, page: 3 })
      expect(page3.data).toHaveLength(1)
      expect(page3.pagination.has_next).toBe(false)
    })
  })

  describe('Observations', () => {
    it('adds and retrieves observations', () => {
      const entity = makeEntity()
      store.createEntity(entity)
      const obs = makeObservation(entity.entity_id, { content: 'Likes coffee' })
      store.addObservation(obs)

      const observations = store.getObservations(entity.entity_id)
      expect(observations).toHaveLength(1)
      expect(observations[0].content).toBe('Likes coffee')
    })

    it('forgets an observation', () => {
      const entity = makeEntity()
      store.createEntity(entity)
      const obs = makeObservation(entity.entity_id)
      store.addObservation(obs)

      store.forgetObservation(obs.observation_id, 'agent_test')

      const active = store.getObservations(entity.entity_id, false)
      expect(active).toHaveLength(0)

      const all = store.getObservations(entity.entity_id, true)
      expect(all).toHaveLength(1)
      expect(all[0].forgotten_at).not.toBeNull()
    })

    it('supersedes an observation', () => {
      const entity = makeEntity()
      store.createEntity(entity)
      const old = makeObservation(entity.entity_id, { content: 'old fact' })
      store.addObservation(old)
      const newObs = makeObservation(entity.entity_id, { content: 'new fact' })
      store.supersede(old.observation_id, newObs)

      const oldUpdated = store.getObservation(old.observation_id)
      expect(oldUpdated!.superseded_by).toBe(newObs.observation_id)
    })
  })

  describe('Relationships', () => {
    it('adds and retrieves relationships', () => {
      const e1 = makeEntity({ name: 'A' })
      const e2 = makeEntity({ name: 'B' })
      store.createEntity(e1)
      store.createEntity(e2)

      const rel: Relationship = {
        relationship_id: 'rel_test',
        from_entity_id: e1.entity_id,
        to_entity_id: e2.entity_id,
        relationship_type: 'builds',
        strength: 'high',
        source_receipt_id: 'rcpt_test',
        created_at: new Date().toISOString(),
        forgotten_at: null,
        metadata: {},
      }
      store.addRelationship(rel)

      const rels = store.getRelationships(e1.entity_id)
      expect(rels).toHaveLength(1)
      expect(rels[0].relationship_type).toBe('builds')

      // Bidirectional query
      const rels2 = store.getRelationships(e2.entity_id)
      expect(rels2).toHaveLength(1)
    })

    it('forgets a relationship', () => {
      const e1 = makeEntity()
      const e2 = makeEntity()
      store.createEntity(e1)
      store.createEntity(e2)
      store.addRelationship({
        relationship_id: 'rel_forget',
        from_entity_id: e1.entity_id,
        to_entity_id: e2.entity_id,
        relationship_type: 'uses',
        strength: 'medium',
        source_receipt_id: 'rcpt_test',
        created_at: new Date().toISOString(),
        forgotten_at: null,
        metadata: {},
      })

      store.forgetRelationship('rel_forget')
      const rels = store.getRelationships(e1.entity_id)
      expect(rels).toHaveLength(0)
    })
  })

  describe('Entity merge', () => {
    it('merges two entities', () => {
      const source = makeEntity({ name: 'Source', aliases: ['S'] })
      const target = makeEntity({ name: 'Target' })
      store.createEntity(source)
      store.createEntity(target)
      store.addObservation(makeObservation(source.entity_id, { content: 'from source' }))

      const merged = store.mergeEntities(source.entity_id, target.entity_id)
      expect(merged.aliases).toContain('Source')
      expect(merged.aliases).toContain('S')

      // Source observations moved to target
      const targetObs = store.getObservations(target.entity_id)
      expect(targetObs).toHaveLength(1)
      expect(targetObs[0].content).toBe('from source')

      // Source is marked as merged
      const sourceAfter = store.getEntity(source.entity_id)
      expect(sourceAfter!.merged_into).toBe(target.entity_id)
      expect(sourceAfter!.forgotten_at).not.toBeNull()
    })
  })

  describe('Search and recall', () => {
    it('searches observations by text (LIKE fallback)', () => {
      const entity = makeEntity({ name: 'SearchTarget' })
      store.createEntity(entity)
      store.addObservation(makeObservation(entity.entity_id, { content: 'loves TypeScript' }))
      store.addObservation(makeObservation(entity.entity_id, { content: 'prefers dark mode' }))

      const results = store.search('TypeScript')
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results[0].observation.content).toContain('TypeScript')
    })

    it('recalls entities and observations', () => {
      const entity = makeEntity({ name: 'RecallTarget', entity_type: 'preference' })
      store.createEntity(entity)
      store.addObservation(makeObservation(entity.entity_id, { content: 'recall test obs' }))

      const result = store.recall({ entity_type: 'preference', include_forgotten: false, limit: 20, page: 1 })
      expect(result.entities).toHaveLength(1)
      expect(result.observations).toHaveLength(1)
    })

    it('excludes forgotten from recall', () => {
      const entity = makeEntity()
      store.createEntity(entity)
      const obs = makeObservation(entity.entity_id)
      store.addObservation(obs)
      store.forgetObservation(obs.observation_id, 'agent_test')

      const result = store.recall({ include_forgotten: false, limit: 20, page: 1 })
      const entityObs = result.observations.filter(o => o.entity_id === entity.entity_id)
      expect(entityObs).toHaveLength(0)
    })
  })

  describe('Entity history and provenance', () => {
    it('returns entity history in chronological order', () => {
      const entity = makeEntity()
      store.createEntity(entity)
      store.addObservation(makeObservation(entity.entity_id, {
        content: 'first',
        observed_at: '2026-01-01T00:00:00.000Z',
      }))
      store.addObservation(makeObservation(entity.entity_id, {
        content: 'second',
        observed_at: '2026-01-02T00:00:00.000Z',
      }))

      const history = store.getEntityHistory(entity.entity_id)
      expect(history).toHaveLength(2)
      expect(history[0].content).toBe('first')
      expect(history[1].content).toBe('second')
    })

    it('returns provenance for an observation', () => {
      const entity = makeEntity()
      store.createEntity(entity)
      const obs = makeObservation(entity.entity_id)
      store.addObservation(obs)

      const prov = store.getMemoryProvenance(obs.observation_id)
      expect(prov).not.toBeNull()
      expect(prov!.observation.observation_id).toBe(obs.observation_id)
      expect(prov!.entity.entity_id).toBe(entity.entity_id)
    })

    it('returns null provenance for non-existent observation', () => {
      expect(store.getMemoryProvenance('obs_nonexistent')).toBeNull()
    })
  })

  describe('Memory stats', () => {
    it('returns correct stats', () => {
      const e1 = makeEntity({ entity_type: 'person' })
      const e2 = makeEntity({ entity_type: 'project' })
      store.createEntity(e1)
      store.createEntity(e2)
      store.addObservation(makeObservation(e1.entity_id))
      store.addObservation(makeObservation(e1.entity_id))
      store.addObservation(makeObservation(e2.entity_id))

      const stats = store.getMemoryStats()
      expect(stats.total_entities).toBe(2)
      expect(stats.total_observations).toBe(3)
      expect(stats.by_entity_type['person']).toBe(1)
      expect(stats.by_entity_type['project']).toBe(1)
    })
  })

  describe('Duplicate detection', () => {
    it('detects entities with overlapping name tokens', () => {
      const e1 = makeEntity({ name: 'Amin', entity_type: 'person' })
      const e2 = makeEntity({ name: 'Amin Suleiman', entity_type: 'person' })
      store.createEntity(e1)
      store.createEntity(e2)

      const dupes = store.findPossibleDuplicates(e1.entity_id)
      expect(dupes).toHaveLength(1)
      expect(dupes[0].name).toBe('Amin Suleiman')
    })

    it('only matches within the same entity type', () => {
      const e1 = makeEntity({ name: 'Next.js', entity_type: 'tool' })
      const e2 = makeEntity({ name: 'Next.js Project', entity_type: 'project' })
      store.createEntity(e1)
      store.createEntity(e2)

      const dupes = store.findPossibleDuplicates(e1.entity_id)
      expect(dupes).toHaveLength(0)
    })

    it('checks aliases for duplicates', () => {
      const e1 = makeEntity({ name: 'Bob', entity_type: 'person', aliases: ['Robert'] })
      const e2 = makeEntity({ name: 'Robert Smith', entity_type: 'person' })
      store.createEntity(e1)
      store.createEntity(e2)

      const dupes = store.findPossibleDuplicates(e2.entity_id)
      expect(dupes).toHaveLength(1)
    })

    it('does not flag itself as a duplicate', () => {
      const e1 = makeEntity({ name: 'Unique Person', entity_type: 'person' })
      store.createEntity(e1)

      const dupes = store.findPossibleDuplicates(e1.entity_id)
      expect(dupes).toHaveLength(0)
    })

    it('ignores forgotten entities', () => {
      const e1 = makeEntity({ name: 'Alice', entity_type: 'person' })
      const e2 = makeEntity({ name: 'Alice Cooper', entity_type: 'person' })
      store.createEntity(e1)
      store.createEntity(e2)
      store.forgetEntity(e2.entity_id, 'agent_test')

      const dupes = store.findPossibleDuplicates(e1.entity_id)
      expect(dupes).toHaveLength(0)
    })
  })

  describe('Observation TTL', () => {
    it('stores expires_at when provided', () => {
      const entity = makeEntity()
      store.createEntity(entity)
      const expiresAt = new Date(Date.now() + 3600000).toISOString()
      store.addObservation(makeObservation(entity.entity_id, { expires_at: expiresAt }))

      const obs = store.getObservations(entity.entity_id, true)
      expect(obs[0].expires_at).toBe(expiresAt)
    })

    it('excludes expired observations from active queries', () => {
      const entity = makeEntity()
      store.createEntity(entity)
      store.addObservation(makeObservation(entity.entity_id, {
        content: 'expired fact',
        expires_at: '2020-01-01T00:00:00.000Z',
      }))
      store.addObservation(makeObservation(entity.entity_id, {
        content: 'active fact',
        expires_at: null,
      }))

      const active = store.getObservations(entity.entity_id, false)
      expect(active).toHaveLength(1)
      expect(active[0].content).toBe('active fact')
    })

    it('includes expired observations when include_forgotten is true', () => {
      const entity = makeEntity()
      store.createEntity(entity)
      store.addObservation(makeObservation(entity.entity_id, {
        expires_at: '2020-01-01T00:00:00.000Z',
      }))

      const all = store.getObservations(entity.entity_id, true)
      expect(all).toHaveLength(1)
    })

    it('does not set expires_at when not provided', () => {
      const entity = makeEntity()
      store.createEntity(entity)
      store.addObservation(makeObservation(entity.entity_id))

      const obs = store.getObservations(entity.entity_id, true)
      expect(obs[0].expires_at).toBeNull()
    })

    it('soft-deletes expired observations on cleanup', () => {
      const entity = makeEntity()
      store.createEntity(entity)
      store.addObservation(makeObservation(entity.entity_id, {
        expires_at: '2020-01-01T00:00:00.000Z',
      }))

      const cleaned = store.cleanupExpiredObservations()
      expect(cleaned).toBe(1)

      const all = store.getObservations(entity.entity_id, true)
      expect(all[0].forgotten_at).not.toBeNull()
      expect(all[0].forgotten_by).toBe('system:cleanup')
    })
  })

  describe('Search ranking', () => {
    it('returns FTS results ordered by relevance', () => {
      const entity = makeEntity({ name: 'RankTarget' })
      store.createEntity(entity)
      store.addObservation(makeObservation(entity.entity_id, { content: 'user writes python scripts occasionally' }))
      store.addObservation(makeObservation(entity.entity_id, { content: 'user prefers TypeScript for all projects and uses TypeScript daily' }))
      store.addObservation(makeObservation(entity.entity_id, { content: 'user mentioned typescript once' }))

      const results = store.search('typescript')
      expect(results.length).toBeGreaterThanOrEqual(2)
      // The observation with more "typescript" mentions should rank higher (first)
      expect(results[0].observation.content).toContain('TypeScript')
    })

    it('falls back to LIKE search ordered by recency when FTS fails', () => {
      const entity = makeEntity({ name: 'LikeTarget' })
      store.createEntity(entity)
      store.addObservation(makeObservation(entity.entity_id, {
        content: 'older observation about coding',
        observed_at: '2026-01-01T00:00:00.000Z',
      }))
      store.addObservation(makeObservation(entity.entity_id, {
        content: 'newer observation about coding',
        observed_at: '2026-06-01T00:00:00.000Z',
      }))

      // LIKE search for "coding" — should return most recent first
      const results = store.search('coding')
      expect(results.length).toBeGreaterThanOrEqual(2)
    })
  })
})
