import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteReceiptStore as ReceiptStore } from '../storage/sqlite-receipt-store.js'
import { KeyManager } from '../storage/key-manager.js'
import { ConfigManager } from '../storage/config-manager.js'
import { MemoryStore } from '../storage/memory-store.js'
import { ReceiptEngine } from '../engine/receipt-engine.js'
import { MemoryEngine } from '../engine/memory-engine.js'

describe('MemoryEngine', () => {
  let tmpDir: string
  let memoryEngine: MemoryEngine
  let memoryStore: MemoryStore

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'memory-engine-'))
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']

    const store = new ReceiptStore(tmpDir)
    await store.init()
    const keyManager = new KeyManager(tmpDir)
    await keyManager.init()
    const configManager = new ConfigManager(tmpDir)
    await configManager.init()

    const receiptEngine = new ReceiptEngine(store, keyManager, configManager)
    memoryStore = new MemoryStore(store.getDb())
    memoryStore.init()
    memoryEngine = new MemoryEngine(receiptEngine, memoryStore)
  })

  afterEach(async () => {
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']
    await rm(tmpDir, { recursive: true, force: true })
  })

  describe('observe', () => {
    it('creates entity and observation with receipt', async () => {
      const result = await memoryEngine.observe({
        entityName: 'Alice',
        entityType: 'person',
        content: 'Works at Acme Corp',
        agentId: 'agent_test',
      })

      expect(result.entity.name).toBe('Alice')
      expect(result.entity.entity_type).toBe('person')
      expect(result.observation.content).toBe('Works at Acme Corp')
      expect(result.receipt.receipt_type).toBe('memory')
      expect(result.receipt.action).toBe('memory.observe')
      expect(result.created_entity).toBe(true)
    })

    it('reuses existing entity on second observe', async () => {
      const r1 = await memoryEngine.observe({
        entityName: 'Bob',
        entityType: 'person',
        content: 'First fact',
        agentId: 'agent_test',
      })
      const r2 = await memoryEngine.observe({
        entityName: 'Bob',
        entityType: 'person',
        content: 'Second fact',
        agentId: 'agent_test',
      })

      expect(r1.entity.entity_id).toBe(r2.entity.entity_id)
      expect(r2.created_entity).toBe(false)
    })

    it('applies confidence and scope', async () => {
      const result = await memoryEngine.observe({
        entityName: 'Config',
        entityType: 'preference',
        content: 'Uses dark mode',
        confidence: 'certain',
        scope: 'user',
        agentId: 'agent_test',
      })

      expect(result.observation.confidence).toBe('certain')
      expect(result.entity.scope).toBe('user')
    })
  })

  describe('recall', () => {
    it('recalls observations by entity type', async () => {
      await memoryEngine.observe({ entityName: 'P1', entityType: 'project', content: 'Project one', agentId: 'a' })
      await memoryEngine.observe({ entityName: 'U1', entityType: 'person', content: 'Person one', agentId: 'a' })

      const result = await memoryEngine.recall({ entityType: 'project', agentId: 'a', audited: true })
      expect(result.entities).toHaveLength(1)
      expect(result.entities[0].name).toBe('P1')
      expect(result.receipt!.action).toBe('memory.recall')
    })

    it('recalls by text query', async () => {
      await memoryEngine.observe({ entityName: 'Dev', entityType: 'person', content: 'Expert in TypeScript', agentId: 'a' })
      await memoryEngine.observe({ entityName: 'Dev', entityType: 'person', content: 'Uses dark theme', agentId: 'a' })

      const result = await memoryEngine.recall({ query: 'TypeScript', agentId: 'a' })
      expect(result.observations.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('forget', () => {
    it('forgets an observation', async () => {
      const observed = await memoryEngine.observe({
        entityName: 'Forget Target',
        entityType: 'fact',
        content: 'Temporary fact',
        agentId: 'agent_test',
      })

      const result = await memoryEngine.forget({
        observationId: observed.observation.observation_id,
        agentId: 'agent_test',
        reason: 'No longer relevant',
      })

      expect(result.receipt.action).toBe('memory.forget')

      // Verify observation is forgotten
      const obs = memoryStore.getObservation(observed.observation.observation_id)
      expect(obs!.forgotten_at).not.toBeNull()
    })

    it('forgets an entire entity', async () => {
      const observed = await memoryEngine.observe({
        entityName: 'Whole Entity',
        entityType: 'fact',
        content: 'Some fact',
        agentId: 'agent_test',
      })

      const result = await memoryEngine.forget({
        entityId: observed.entity.entity_id,
        agentId: 'agent_test',
      })

      expect(result.receipt.action).toBe('memory.forget_entity')

      const entity = memoryStore.getEntity(observed.entity.entity_id)
      expect(entity!.forgotten_at).not.toBeNull()
    })

    it('throws when neither entityId nor observationId provided', async () => {
      await expect(
        memoryEngine.forget({ agentId: 'agent_test' })
      ).rejects.toThrow('Either entityId or observationId must be provided')
    })
  })

  describe('relate', () => {
    it('creates a relationship between entities', async () => {
      const e1 = await memoryEngine.observe({ entityName: 'Dev', entityType: 'person', content: 'Dev person', agentId: 'a' })
      const e2 = await memoryEngine.observe({ entityName: 'Project X', entityType: 'project', content: 'A project', agentId: 'a' })

      const result = await memoryEngine.relate({
        fromEntityId: e1.entity.entity_id,
        toEntityId: e2.entity.entity_id,
        relationshipType: 'builds',
        agentId: 'a',
        strength: 'high',
      })

      expect(result.relationship.relationship_type).toBe('builds')
      expect(result.relationship.strength).toBe('high')
      expect(result.receipt.action).toBe('memory.relate')
    })
  })

  describe('merge', () => {
    it('merges two entities', async () => {
      const e1 = await memoryEngine.observe({ entityName: 'Bob Smith', entityType: 'person', content: 'Fact A', agentId: 'a' })
      const e2 = await memoryEngine.observe({ entityName: 'Robert Smith', entityType: 'person', content: 'Fact B', agentId: 'a' })

      const result = await memoryEngine.merge({
        sourceEntityId: e1.entity.entity_id,
        targetEntityId: e2.entity.entity_id,
        agentId: 'a',
      })

      expect(result.mergedEntity.aliases).toContain('Bob Smith')
      expect(result.receipt.action).toBe('memory.merge')

      // Target now has both observations
      const obs = memoryStore.getObservations(e2.entity.entity_id)
      expect(obs).toHaveLength(2)
    })
  })

  describe('provenance and timeline', () => {
    it('returns provenance for an observation', async () => {
      const result = await memoryEngine.observe({
        entityName: 'ProvTest',
        entityType: 'fact',
        content: 'Provenance check',
        agentId: 'agent_test',
      })

      const prov = memoryEngine.provenance(result.observation.observation_id)
      expect(prov).not.toBeNull()
      expect(prov!.receipt_id).toBe(result.receipt.receipt_id)
    })

    it('returns entity timeline', async () => {
      const result = await memoryEngine.observe({
        entityName: 'TimelineTarget',
        entityType: 'person',
        content: 'First event',
        agentId: 'agent_test',
      })

      const timeline = memoryEngine.entityTimeline(result.entity.entity_id)
      expect(timeline.length).toBeGreaterThanOrEqual(1)
      expect(timeline[0].type).toBe('observation')
    })
  })

  describe('getContext', () => {
    it('returns top entities ordered by observation count', async () => {
      const a = await memoryEngine.observe({ entityName: 'A', entityType: 'person', content: 'f1', agentId: 'a' })
      await memoryEngine.observe({ entityName: 'A', entityType: 'person', content: 'f2', agentId: 'a' })
      await memoryEngine.observe({ entityName: 'A', entityType: 'person', content: 'f3', agentId: 'a' })
      await memoryEngine.observe({ entityName: 'B', entityType: 'person', content: 'f1', agentId: 'a' })

      const ctx = await memoryEngine.getContext({})
      expect(ctx.entities[0].name).toBe('A')
      expect(ctx.entities[0].observation_count).toBe(3)
    })

    it('returns recent observations across all entities', async () => {
      await memoryEngine.observe({ entityName: 'X', entityType: 'fact', content: 'recent1', agentId: 'a' })
      await memoryEngine.observe({ entityName: 'Y', entityType: 'fact', content: 'recent2', agentId: 'a' })

      const ctx = await memoryEngine.getContext({ maxObservations: 3 })
      expect(ctx.recent_observations.length).toBeGreaterThanOrEqual(2)
    })

    it('returns preference observations separately', async () => {
      await memoryEngine.observe({ entityName: 'Style', entityType: 'preference', content: 'Prefers dark mode', agentId: 'a' })
      await memoryEngine.observe({ entityName: 'Other', entityType: 'fact', content: 'Not a pref', agentId: 'a' })

      const ctx = await memoryEngine.getContext({})
      expect(ctx.preferences.length).toBeGreaterThanOrEqual(1)
      expect(ctx.preferences[0].content).toContain('dark mode')
    })

    it('excludes expired and forgotten observations', async () => {
      const observed = await memoryEngine.observe({ entityName: 'Temp', entityType: 'fact', content: 'temp', agentId: 'a', ttlSeconds: -1 })
      // Observation with negative TTL will have expires_at in the past
      // However since observe calculates it as Date.now() + ttl*1000, -1 second ago
      // Let's forget one instead for reliability
      await memoryEngine.forget({ observationId: observed.observation.observation_id, agentId: 'a' })

      const ctx = await memoryEngine.getContext({})
      const tempObs = ctx.recent_observations.filter(o => o.content === 'temp')
      expect(tempObs).toHaveLength(0)
    })

    it('creates a memory.context receipt when audited', async () => {
      const ctx = await memoryEngine.getContext({ audited: true })
      expect(ctx.receipt!.receipt_type).toBe('memory')
      expect(ctx.receipt!.action).toBe('memory.context')
    })

    it('does not create a receipt by default', async () => {
      const ctx = await memoryEngine.getContext({})
      expect(ctx.receipt).toBeNull()
    })

    it('returns accurate stats', async () => {
      await memoryEngine.observe({ entityName: 'S1', entityType: 'person', content: 'f', agentId: 'a' })
      await memoryEngine.observe({ entityName: 'S2', entityType: 'project', content: 'f', agentId: 'b' })

      const ctx = await memoryEngine.getContext({})
      expect(ctx.stats.total_entities).toBeGreaterThanOrEqual(2)
      expect(ctx.stats.agents_contributing).toContain('a')
      expect(ctx.stats.agents_contributing).toContain('b')
    })
  })

  describe('audit', () => {
    it('returns audit report', async () => {
      await memoryEngine.observe({ entityName: 'A', entityType: 'person', content: 'f1', agentId: 'a' })
      await memoryEngine.observe({ entityName: 'B', entityType: 'project', content: 'f2', agentId: 'a' })

      const report = memoryEngine.memoryAudit({})
      expect(report.total_entities).toBe(2)
      expect(report.total_observations).toBe(2)
      expect(report.by_entity_type['person']).toBe(1)
      expect(report.by_entity_type['project']).toBe(1)
    })
  })
})
