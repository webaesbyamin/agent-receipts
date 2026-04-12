import { nanoid } from 'nanoid'
import type {
  Entity,
  Observation,
  Relationship,
  EntityType,
  MemoryScope,
  ConfidenceLevel,
  MemoryQuery,
  MemoryBundle,
} from '@agent-receipts/schema'
import type { ActionReceipt } from '@agent-receipts/schema'
import { MemoryStore } from '../storage/memory-store.js'
import type { ProvenanceChain } from '../storage/memory-store.js'
import { ReceiptEngine } from './receipt-engine.js'
import { hashData } from '../hash.js'

export interface ObserveParams {
  entityName: string
  entityType: EntityType
  content: string
  confidence?: ConfidenceLevel
  scope?: MemoryScope
  agentId: string
  context?: string
  tags?: string[]
  ttlSeconds?: number
}

export interface ObserveResult {
  entity: Entity
  observation: Observation
  receipt: ActionReceipt
  created_entity: boolean
}

export interface RecallParams {
  query?: string
  entityType?: EntityType
  entityId?: string
  agentId: string
  scope?: MemoryScope
  limit?: number
  audited?: boolean
}

export interface RecallResult {
  entities: Entity[]
  observations: Observation[]
  receipt: ActionReceipt | null
}

export interface ForgetParams {
  entityId?: string
  observationId?: string
  agentId: string
  reason?: string
}

export interface RelateParams {
  fromEntityId: string
  toEntityId: string
  relationshipType: string
  agentId: string
  strength?: ConfidenceLevel
  context?: string
}

export interface MergeParams {
  sourceEntityId: string
  targetEntityId: string
  agentId: string
}

export interface AuditParams {
  agentId?: string
  entityId?: string
  from?: string
  to?: string
}

export interface TimelineEntry {
  type: 'observation' | 'relationship' | 'forget' | 'merge'
  timestamp: string
  data: Observation | Relationship | Record<string, unknown>
}

export interface ContextParams {
  agentId?: string
  scope?: MemoryScope
  maxEntities?: number
  maxObservations?: number
  audited?: boolean
}

export interface ContextResult {
  entities: Array<Entity & { observation_count: number; latest_observation: string }>
  recent_observations: Observation[]
  relationships: Relationship[]
  preferences: Observation[]
  stats: {
    total_entities: number
    total_observations: number
    total_relationships: number
    agents_contributing: string[]
  }
  receipt: ActionReceipt | null
}

export interface ExportBundleParams {
  entityIds?: string[]
  includeReceipts?: boolean
  includeForgotten?: boolean
  description?: string
}

export interface ImportBundleResult {
  imported: { entities: number; observations: number; relationships: number }
  skipped: { entities: number; observations: number; relationships: number }
  receipt: ActionReceipt
}

export interface AuditReport {
  total_entities: number
  total_observations: number
  total_relationships: number
  forgotten_observations: number
  forgotten_entities: number
  by_entity_type: Record<string, number>
}

export class MemoryEngine {
  constructor(
    private receiptEngine: ReceiptEngine,
    private memoryStore: MemoryStore,
  ) {}

  async observe(params: ObserveParams): Promise<ObserveResult> {
    const scope = params.scope ?? 'agent'
    const confidence = params.confidence ?? 'medium'
    let createdEntity = false

    // Find or create entity
    let entity = this.memoryStore.findEntityByName(params.entityName, params.entityType)

    // Create receipt first so we have the receipt_id
    const receipt = await this.receiptEngine.create({
      action: 'memory.observe',
      receipt_type: 'memory',
      input_hash: hashData({ entityName: params.entityName, content: params.content }),
      status: 'completed',
      metadata: {
        memory: {
          memory_operation: 'observe',
          entity_id: entity?.entity_id ?? null,
          observation_id: null, // Will be set below
          relationship_id: null,
          scope,
          query: null,
          results_count: null,
          confidence,
        },
      },
    })

    if (!entity) {
      entity = this.memoryStore.createEntity({
        entity_id: `ent_${nanoid(12)}`,
        entity_type: params.entityType,
        name: params.entityName,
        aliases: [],
        scope,
        created_at: new Date().toISOString(),
        created_by_agent: params.agentId,
        created_by_receipt: receipt.receipt_id,
        forgotten_at: null,
        merged_into: null,
        attributes: {},
        metadata: {},
      })
      createdEntity = true
    }

    const observation = this.memoryStore.addObservation({
      observation_id: `obs_${nanoid(12)}`,
      entity_id: entity.entity_id,
      content: params.content,
      confidence,
      source_receipt_id: receipt.receipt_id,
      source_agent_id: params.agentId,
      source_context: params.context ?? null,
      observed_at: new Date().toISOString(),
      forgotten_at: null,
      forgotten_by: null,
      superseded_by: null,
      expires_at: params.ttlSeconds
        ? new Date(Date.now() + params.ttlSeconds * 1000).toISOString()
        : null,
      tags: params.tags ?? [],
      metadata: {},
    })

    return { entity, observation, receipt, created_entity: createdEntity }
  }

  async recall(params: RecallParams): Promise<RecallResult> {
    const memoryQuery: MemoryQuery = {
      query: params.query,
      entity_type: params.entityType,
      entity_id: params.entityId,
      scope: params.scope,
      limit: params.limit ?? 20,
      include_forgotten: false,
      page: 1,
    }

    const result = this.memoryStore.recall(memoryQuery)

    let receipt: ActionReceipt | null = null
    if (params.audited) {
      receipt = await this.receiptEngine.create({
        action: 'memory.recall',
        receipt_type: 'memory',
        input_hash: hashData({ query: params.query, entityType: params.entityType, entityId: params.entityId }),
        output_hash: hashData({ entities: result.entities.length, observations: result.observations.length }),
        status: 'completed',
        metadata: {
          memory: {
            memory_operation: 'recall',
            entity_id: params.entityId ?? null,
            observation_id: null,
            relationship_id: null,
            scope: params.scope ?? 'agent',
            query: params.query ?? null,
            results_count: result.total,
            confidence: null,
          },
        },
      })
    }

    return {
      entities: result.entities,
      observations: result.observations,
      receipt,
    }
  }

  async forget(params: ForgetParams): Promise<{ receipt: ActionReceipt }> {
    const operation = params.entityId ? 'memory.forget_entity' : 'memory.forget'

    if (params.entityId) {
      this.memoryStore.forgetEntity(params.entityId, params.agentId)
    } else if (params.observationId) {
      this.memoryStore.forgetObservation(params.observationId, params.agentId)
    } else {
      throw new Error('Either entityId or observationId must be provided')
    }

    const receipt = await this.receiptEngine.create({
      action: operation,
      receipt_type: 'memory',
      input_hash: hashData({ entityId: params.entityId, observationId: params.observationId, reason: params.reason }),
      status: 'completed',
      metadata: {
        memory: {
          memory_operation: params.entityId ? 'forget_entity' : 'forget',
          entity_id: params.entityId ?? null,
          observation_id: params.observationId ?? null,
          relationship_id: null,
          scope: 'agent',
          query: null,
          results_count: null,
          confidence: null,
        },
        reason: params.reason,
      },
    })

    return { receipt }
  }

  async relate(params: RelateParams): Promise<{ relationship: Relationship; receipt: ActionReceipt }> {
    const receipt = await this.receiptEngine.create({
      action: 'memory.relate',
      receipt_type: 'memory',
      input_hash: hashData({ from: params.fromEntityId, to: params.toEntityId, type: params.relationshipType }),
      status: 'completed',
      metadata: {
        memory: {
          memory_operation: 'observe',
          entity_id: params.fromEntityId,
          observation_id: null,
          relationship_id: null,
          scope: 'agent',
          query: null,
          results_count: null,
          confidence: params.strength ?? 'medium',
        },
      },
    })

    const relationship = this.memoryStore.addRelationship({
      relationship_id: `rel_${nanoid(12)}`,
      from_entity_id: params.fromEntityId,
      to_entity_id: params.toEntityId,
      relationship_type: params.relationshipType,
      strength: params.strength ?? 'medium',
      source_receipt_id: receipt.receipt_id,
      created_at: new Date().toISOString(),
      forgotten_at: null,
      metadata: params.context ? { context: params.context } : {},
    })

    return { relationship, receipt }
  }

  async merge(params: MergeParams): Promise<{ mergedEntity: Entity; receipt: ActionReceipt }> {
    const mergedEntity = this.memoryStore.mergeEntities(params.sourceEntityId, params.targetEntityId)

    const receipt = await this.receiptEngine.create({
      action: 'memory.merge',
      receipt_type: 'memory',
      input_hash: hashData({ source: params.sourceEntityId, target: params.targetEntityId }),
      output_hash: hashData(mergedEntity),
      status: 'completed',
      metadata: {
        memory: {
          memory_operation: 'merge',
          entity_id: params.targetEntityId,
          observation_id: null,
          relationship_id: null,
          scope: mergedEntity.scope,
          query: null,
          results_count: null,
          confidence: null,
        },
      },
    })

    return { mergedEntity, receipt }
  }

  provenance(observationId: string): ProvenanceChain | null {
    return this.memoryStore.getMemoryProvenance(observationId)
  }

  entityTimeline(entityId: string): TimelineEntry[] {
    const observations = this.memoryStore.getEntityHistory(entityId)
    const relationships = this.memoryStore.getRelationships(entityId)

    const entries: TimelineEntry[] = []

    for (const obs of observations) {
      entries.push({
        type: obs.forgotten_at ? 'forget' : 'observation',
        timestamp: obs.observed_at,
        data: obs,
      })
    }

    for (const rel of relationships) {
      entries.push({
        type: 'relationship',
        timestamp: rel.created_at,
        data: rel,
      })
    }

    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    return entries
  }

  memoryAudit(params: AuditParams): AuditReport {
    return this.memoryStore.getMemoryStats(params.agentId, params.from, params.to)
  }

  async getContext(params: ContextParams): Promise<ContextResult> {
    const maxEntities = Math.min(params.maxEntities ?? 10, 50)
    const maxObservations = Math.min(params.maxObservations ?? 20, 100)

    const entities = this.memoryStore.getTopEntities(maxEntities, params.scope)
    const recent_observations = this.memoryStore.getRecentObservations(maxObservations, params.agentId)
    const relationships = this.memoryStore.getActiveRelationships(50)
    const preferences = this.memoryStore.getPreferenceObservations(20)
    const stats = this.memoryStore.getContextStats()

    let receipt: ActionReceipt | null = null
    if (params.audited) {
      receipt = await this.receiptEngine.create({
        action: 'memory.context',
        receipt_type: 'memory',
        input_hash: hashData({ scope: params.scope, maxEntities, maxObservations }),
        output_hash: hashData({ entities: entities.length, observations: recent_observations.length }),
        status: 'completed',
        metadata: {
          memory: {
            memory_operation: 'recall',
            entity_id: null,
            observation_id: null,
            relationship_id: null,
            scope: params.scope ?? 'agent',
            query: null,
            results_count: entities.length + recent_observations.length,
            confidence: null,
          },
        },
      })
    }

    return { entities, recent_observations, relationships, preferences, stats, receipt }
  }

  async exportBundle(params?: ExportBundleParams): Promise<MemoryBundle> {
    const { entityIds, includeReceipts = true, includeForgotten = false, description = null } = params ?? {}

    const entityResult = entityIds
      ? entityIds.map(id => this.memoryStore.getEntity(id)).filter((e): e is Entity => e !== null)
      : this.memoryStore.findEntities({ include_forgotten: includeForgotten, limit: 100, page: 1 }).data

    const observations: Observation[] = []
    for (const entity of entityResult) {
      const obs = this.memoryStore.getObservations(entity.entity_id, includeForgotten)
      observations.push(...obs)
    }

    const seenRelIds = new Set<string>()
    const relationships: Relationship[] = []
    for (const entity of entityResult) {
      const rels = this.memoryStore.getRelationships(entity.entity_id)
      for (const rel of rels) {
        if (!seenRelIds.has(rel.relationship_id)) {
          seenRelIds.add(rel.relationship_id)
          relationships.push(rel)
        }
      }
    }

    let receipts: Record<string, unknown>[] = []
    if (includeReceipts) {
      const receiptIds = new Set<string>()
      for (const obs of observations) receiptIds.add(obs.source_receipt_id)
      for (const entity of entityResult) receiptIds.add(entity.created_by_receipt)
      for (const rel of relationships) receiptIds.add(rel.source_receipt_id)
      for (const id of receiptIds) {
        const receipt = await this.receiptEngine.get(id)
        if (receipt) receipts.push(receipt as unknown as Record<string, unknown>)
      }
    }

    const checksumPayload = JSON.stringify({
      entities: [...entityResult].sort((a, b) => a.entity_id.localeCompare(b.entity_id)),
      observations: [...observations].sort((a, b) => a.observation_id.localeCompare(b.observation_id)),
      relationships: [...relationships].sort((a, b) => a.relationship_id.localeCompare(b.relationship_id)),
    })
    const checksum = hashData(checksumPayload)
    const publicKey = this.receiptEngine.getPublicKey()

    const allAgents = new Set<string>()
    observations.forEach(o => allAgents.add(o.source_agent_id))
    const timestamps = observations.map(o => o.observed_at).sort()
    const now = new Date().toISOString()

    return {
      bundle_id: `bndl_${nanoid(12)}`,
      bundle_version: '1.0' as const,
      created_at: now,
      created_by_agent: 'system',
      description,
      public_key: publicKey,
      entities: entityResult,
      observations,
      relationships,
      receipts,
      checksum,
      stats: {
        entity_count: entityResult.length,
        observation_count: observations.length,
        relationship_count: relationships.length,
        receipt_count: receipts.length,
        agents: Array.from(allAgents),
        date_range: {
          earliest: timestamps[0] ?? now,
          latest: timestamps[timestamps.length - 1] ?? now,
        },
      },
    }
  }

  async importBundle(bundle: MemoryBundle, params?: {
    skipExisting?: boolean
  }): Promise<ImportBundleResult> {
    const { skipExisting = true } = params ?? {}

    // Verify checksum
    const checksumPayload = JSON.stringify({
      entities: [...bundle.entities].sort((a, b) => a.entity_id.localeCompare(b.entity_id)),
      observations: [...bundle.observations].sort((a, b) => a.observation_id.localeCompare(b.observation_id)),
      relationships: [...bundle.relationships].sort((a, b) => a.relationship_id.localeCompare(b.relationship_id)),
    })
    const computedChecksum = hashData(checksumPayload)
    if (computedChecksum !== bundle.checksum) {
      throw new Error('Bundle checksum mismatch — data may have been tampered with')
    }

    const imported = { entities: 0, observations: 0, relationships: 0 }
    const skipped = { entities: 0, observations: 0, relationships: 0 }

    for (const entity of bundle.entities) {
      const existing = this.memoryStore.getEntity(entity.entity_id)
      if (existing && skipExisting) {
        skipped.entities++
        continue
      }
      if (!existing) {
        this.memoryStore.createEntity(entity)
        imported.entities++
      }
    }

    for (const obs of bundle.observations) {
      const existing = this.memoryStore.getObservation(obs.observation_id)
      if (existing && skipExisting) {
        skipped.observations++
        continue
      }
      if (!existing) {
        this.memoryStore.addObservation(obs)
        imported.observations++
      }
    }

    for (const rel of bundle.relationships) {
      try {
        this.memoryStore.addRelationship(rel)
        imported.relationships++
      } catch {
        skipped.relationships++
      }
    }

    const receipt = await this.receiptEngine.create({
      action: 'memory.import_bundle',
      receipt_type: 'memory',
      input_hash: hashData({ bundle_id: bundle.bundle_id }),
      output_hash: hashData(imported),
      status: 'completed',
      metadata: {
        memory: {
          memory_operation: 'create',
          entity_id: null,
          observation_id: null,
          relationship_id: null,
          scope: 'user',
          query: null,
          results_count: imported.entities + imported.observations + imported.relationships,
          confidence: null,
        },
        bundle_id: bundle.bundle_id,
      },
    })

    return { imported, skipped, receipt }
  }
}
