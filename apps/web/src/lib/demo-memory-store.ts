import type { Entity, Observation, Relationship, EntityType, MemoryScope } from '@agent-receipts/schema'
import { DEMO_ENTITIES, DEMO_OBSERVATIONS, DEMO_RELATIONSHIPS } from './demo-memory-data'

export interface FindEntitiesQuery {
  entity_type?: EntityType
  scope?: MemoryScope
  query?: string
  include_forgotten?: boolean
  limit?: number
  page?: number
}

export interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export interface PaginatedEntities {
  data: Entity[]
  pagination: Pagination
}

export interface MemoryStats {
  total_entities: number
  total_observations: number
  total_relationships: number
  forgotten_observations: number
  forgotten_entities: number
  by_entity_type: Record<string, number>
  by_operation: Record<string, number>
}

export interface SearchResult {
  entity: Entity
  observation: Observation
  rank: number
}

export interface RecallResult {
  entities: Entity[]
  observations: Observation[]
  total: number
}

export interface ProvenanceResult {
  observation: Observation
  entity: Entity
  receipt_id: string
  chain: Array<{ receipt_id: string; action: string; timestamp: string }>
}

export class DemoMemoryStore {
  private entities: Entity[]
  private observations: Observation[]
  private relationships: Relationship[]

  constructor() {
    this.entities = DEMO_ENTITIES
    this.observations = DEMO_OBSERVATIONS
    this.relationships = DEMO_RELATIONSHIPS
  }

  findEntities(query: FindEntitiesQuery): PaginatedEntities {
    const includeForgotten = query.include_forgotten ?? false
    const limit = query.limit ?? 20
    const page = query.page ?? 1

    let filtered = this.entities.filter(e => {
      if (!includeForgotten && e.forgotten_at !== null) return false
      if (!includeForgotten && e.merged_into !== null) return false
      if (query.entity_type && e.entity_type !== query.entity_type) return false
      if (query.scope && e.scope !== query.scope) return false
      if (query.query) {
        const q = query.query.toLowerCase()
        const nameMatch = e.name.toLowerCase().includes(q)
        const aliasMatch = e.aliases.some(a => a.toLowerCase().includes(q))
        if (!nameMatch && !aliasMatch) return false
      }
      return true
    })

    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const offset = (page - 1) * limit
    filtered = filtered.slice(offset, offset + limit)

    return {
      data: filtered,
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

  getEntity(id: string): Entity | null {
    return this.entities.find(e => e.entity_id === id) ?? null
  }

  getObservations(entityId: string, includeForgotten: boolean): Observation[] {
    const now = new Date().toISOString()
    return this.observations.filter(o => {
      if (o.entity_id !== entityId) return false
      if (!includeForgotten && o.forgotten_at !== null) return false
      if (!includeForgotten && o.expires_at && o.expires_at < now) return false
      return true
    }).sort((a, b) => b.observed_at.localeCompare(a.observed_at))
  }

  getRelationships(entityId: string): Relationship[] {
    return this.relationships.filter(
      r => r.from_entity_id === entityId || r.to_entity_id === entityId
    )
  }

  getMemoryStats(): MemoryStats {
    const forgottenObs = this.observations.filter(o => o.forgotten_at !== null).length
    const forgottenEnts = this.entities.filter(e => e.forgotten_at !== null).length

    const byEntityType: Record<string, number> = {}
    for (const e of this.entities) {
      byEntityType[e.entity_type] = (byEntityType[e.entity_type] ?? 0) + 1
    }

    const byOperation: Record<string, number> = {
      observe: 9,
      recall: 3,
      forget: 2,
      context: 1,
    }

    return {
      total_entities: this.entities.length,
      total_observations: this.observations.length,
      total_relationships: this.relationships.length,
      forgotten_observations: forgottenObs,
      forgotten_entities: forgottenEnts,
      by_entity_type: byEntityType,
      by_operation: byOperation,
    }
  }

  search(query: string, filters?: { entity_type?: EntityType; scope?: MemoryScope }): SearchResult[] {
    const q = query.toLowerCase()
    const now = new Date().toISOString()

    const results: SearchResult[] = []
    let rank = 0

    for (const obs of this.observations) {
      if (obs.forgotten_at !== null) continue
      if (obs.expires_at && obs.expires_at < now) continue
      if (!obs.content.toLowerCase().includes(q)) continue

      const entity = this.getEntity(obs.entity_id)
      if (!entity || entity.forgotten_at !== null) continue

      if (filters?.entity_type && entity.entity_type !== filters.entity_type) continue
      if (filters?.scope && entity.scope !== filters.scope) continue

      results.push({ entity, observation: obs, rank: rank++ })
    }

    return results
  }

  recall(query: FindEntitiesQuery): RecallResult {
    if (query.query) {
      const results = this.search(query.query, {
        entity_type: query.entity_type as EntityType | undefined,
        scope: query.scope as MemoryScope | undefined,
      })
      const entityMap = new Map<string, Entity>()
      const observations: Observation[] = []
      for (const r of results) {
        entityMap.set(r.entity.entity_id, r.entity)
        observations.push(r.observation)
      }
      return {
        entities: Array.from(entityMap.values()),
        observations,
        total: observations.length,
      }
    }

    const entityResult = this.findEntities(query)
    const observations: Observation[] = []
    for (const entity of entityResult.data) {
      const obs = this.getObservations(entity.entity_id, query.include_forgotten ?? false)
      observations.push(...obs)
    }

    return {
      entities: entityResult.data,
      observations,
      total: observations.length,
    }
  }

  getProvenance(obsId: string): ProvenanceResult | null {
    const observation = this.observations.find(o => o.observation_id === obsId)
    if (!observation) return null

    const entity = this.getEntity(observation.entity_id)
    if (!entity) return null

    return {
      observation,
      entity,
      receipt_id: observation.source_receipt_id,
      chain: [
        {
          receipt_id: observation.source_receipt_id,
          action: 'memory.observe',
          timestamp: observation.observed_at,
        },
      ],
    }
  }
}

// Singleton instance
let instance: DemoMemoryStore | null = null

export function getDemoMemoryStore(): DemoMemoryStore {
  if (!instance) {
    instance = new DemoMemoryStore()
  }
  return instance
}
