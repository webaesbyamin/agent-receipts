import { describe, it, expect } from 'vitest'
import {
  EntityType,
  MemoryOperation,
  MemoryScope,
  ConfidenceLevel,
  Entity,
  Observation,
  Relationship,
  MemoryReceiptPayload,
  MemoryQuery,
} from '../index'

describe('Memory Schemas', () => {
  describe('EntityType', () => {
    it('accepts all valid entity types', () => {
      const types = ['person', 'project', 'organization', 'preference', 'fact', 'context', 'tool', 'custom']
      for (const t of types) {
        expect(EntityType.parse(t)).toBe(t)
      }
    })

    it('rejects invalid entity type', () => {
      expect(() => EntityType.parse('invalid')).toThrow()
    })
  })

  describe('MemoryOperation', () => {
    it('accepts all valid operations', () => {
      const ops = ['observe', 'create', 'merge', 'forget', 'forget_entity', 'recall', 'update']
      for (const op of ops) {
        expect(MemoryOperation.parse(op)).toBe(op)
      }
    })
  })

  describe('MemoryScope', () => {
    it('accepts all valid scopes', () => {
      const scopes = ['agent', 'user', 'team', 'global']
      for (const s of scopes) {
        expect(MemoryScope.parse(s)).toBe(s)
      }
    })
  })

  describe('ConfidenceLevel', () => {
    it('accepts all valid confidence levels', () => {
      const levels = ['certain', 'high', 'medium', 'low', 'deprecated']
      for (const l of levels) {
        expect(ConfidenceLevel.parse(l)).toBe(l)
      }
    })
  })

  describe('Entity', () => {
    const validEntity = {
      entity_id: 'ent_abc123',
      entity_type: 'person',
      name: 'Alice',
      aliases: ['Al'],
      scope: 'agent',
      created_at: '2026-01-01T00:00:00.000Z',
      created_by_agent: 'agent_1',
      created_by_receipt: 'rcpt_abc',
      forgotten_at: null,
      merged_into: null,
      attributes: {},
      metadata: {},
    }

    it('parses a valid entity', () => {
      const result = Entity.parse(validEntity)
      expect(result.entity_id).toBe('ent_abc123')
      expect(result.name).toBe('Alice')
      expect(result.entity_type).toBe('person')
    })

    it('applies defaults for optional fields', () => {
      const minimal = {
        entity_id: 'ent_min',
        entity_type: 'fact',
        name: 'Test',
        created_at: '2026-01-01T00:00:00.000Z',
        created_by_agent: 'agent_1',
        created_by_receipt: 'rcpt_abc',
        forgotten_at: null,
        merged_into: null,
      }
      const result = Entity.parse(minimal)
      expect(result.aliases).toEqual([])
      expect(result.scope).toBe('agent')
      expect(result.attributes).toEqual({})
      expect(result.metadata).toEqual({})
    })

    it('rejects entity with invalid type', () => {
      expect(() => Entity.parse({ ...validEntity, entity_type: 'invalid' })).toThrow()
    })
  })

  describe('Observation', () => {
    const validObs = {
      observation_id: 'obs_abc123',
      entity_id: 'ent_abc',
      content: 'Prefers TypeScript',
      confidence: 'high',
      source_receipt_id: 'rcpt_abc',
      source_agent_id: 'agent_1',
      source_context: 'conversation about code',
      observed_at: '2026-01-01T00:00:00.000Z',
      forgotten_at: null,
      forgotten_by: null,
      superseded_by: null,
      tags: ['preference'],
      metadata: {},
    }

    it('parses a valid observation', () => {
      const result = Observation.parse(validObs)
      expect(result.content).toBe('Prefers TypeScript')
      expect(result.confidence).toBe('high')
    })

    it('defaults confidence to medium', () => {
      const { confidence: _, ...withoutConf } = validObs
      const result = Observation.parse(withoutConf)
      expect(result.confidence).toBe('medium')
    })

    it('defaults tags to empty array', () => {
      const { tags: _, ...withoutTags } = validObs
      const result = Observation.parse(withoutTags)
      expect(result.tags).toEqual([])
    })
  })

  describe('Relationship', () => {
    it('parses a valid relationship', () => {
      const rel = {
        relationship_id: 'rel_abc',
        from_entity_id: 'ent_1',
        to_entity_id: 'ent_2',
        relationship_type: 'builds',
        strength: 'certain',
        source_receipt_id: 'rcpt_abc',
        created_at: '2026-01-01T00:00:00.000Z',
        forgotten_at: null,
        metadata: {},
      }
      const result = Relationship.parse(rel)
      expect(result.relationship_type).toBe('builds')
      expect(result.strength).toBe('certain')
    })

    it('defaults strength to medium', () => {
      const rel = {
        relationship_id: 'rel_abc',
        from_entity_id: 'ent_1',
        to_entity_id: 'ent_2',
        relationship_type: 'uses',
        source_receipt_id: 'rcpt_abc',
        created_at: '2026-01-01T00:00:00.000Z',
        forgotten_at: null,
      }
      const result = Relationship.parse(rel)
      expect(result.strength).toBe('medium')
    })
  })

  describe('MemoryReceiptPayload', () => {
    it('parses a valid payload', () => {
      const payload = {
        memory_operation: 'observe',
        entity_id: 'ent_abc',
        observation_id: 'obs_abc',
        relationship_id: null,
        scope: 'agent',
        query: null,
        results_count: null,
        confidence: 'high',
      }
      const result = MemoryReceiptPayload.parse(payload)
      expect(result.memory_operation).toBe('observe')
    })
  })

  describe('MemoryQuery', () => {
    it('parses a minimal query with defaults', () => {
      const result = MemoryQuery.parse({})
      expect(result.include_forgotten).toBe(false)
      expect(result.limit).toBe(20)
      expect(result.page).toBe(1)
    })

    it('parses a full query', () => {
      const q = {
        query: 'typescript',
        entity_type: 'preference',
        scope: 'user',
        include_forgotten: true,
        limit: 50,
        page: 2,
      }
      const result = MemoryQuery.parse(q)
      expect(result.query).toBe('typescript')
      expect(result.limit).toBe(50)
      expect(result.include_forgotten).toBe(true)
    })

    it('rejects limit over 100', () => {
      expect(() => MemoryQuery.parse({ limit: 200 })).toThrow()
    })

    it('rejects page less than 1', () => {
      expect(() => MemoryQuery.parse({ page: 0 })).toThrow()
    })
  })
})
