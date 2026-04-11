import Database from 'better-sqlite3'
import type {
  Entity,
  Observation,
  Relationship,
  MemoryQuery,
  EntityType,
  MemoryScope,
  ConfidenceLevel,
} from '@agent-receipts/schema'
import type { PaginatedResult } from '../types.js'

export interface SearchResult {
  entity: Entity
  observation: Observation
  rank: number
}

export interface ProvenanceChain {
  observation: Observation
  entity: Entity
  receipt_id: string
  chain: Array<{ receipt_id: string; action: string; timestamp: string }>
}

export interface MemoryRecallResult {
  entities: Entity[]
  observations: Observation[]
  total: number
}

const CONFIDENCE_ORDER: Record<string, number> = {
  certain: 5,
  high: 4,
  medium: 3,
  low: 2,
  deprecated: 1,
}

export class MemoryStore {
  constructor(private db: Database.Database) {}

  init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        entity_id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        name TEXT NOT NULL,
        aliases TEXT NOT NULL DEFAULT '[]',
        scope TEXT NOT NULL DEFAULT 'agent',
        created_at TEXT NOT NULL,
        created_by_agent TEXT NOT NULL,
        created_by_receipt TEXT NOT NULL,
        forgotten_at TEXT,
        merged_into TEXT,
        attributes TEXT NOT NULL DEFAULT '{}',
        metadata TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
      CREATE INDEX IF NOT EXISTS idx_entities_scope ON entities(scope);
      CREATE INDEX IF NOT EXISTS idx_entities_agent ON entities(created_by_agent);
      CREATE INDEX IF NOT EXISTS idx_entities_forgotten ON entities(forgotten_at);

      CREATE TABLE IF NOT EXISTS observations (
        observation_id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        content TEXT NOT NULL,
        confidence TEXT NOT NULL DEFAULT 'medium',
        source_receipt_id TEXT NOT NULL,
        source_agent_id TEXT NOT NULL,
        source_context TEXT,
        observed_at TEXT NOT NULL,
        forgotten_at TEXT,
        forgotten_by TEXT,
        superseded_by TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        metadata TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (entity_id) REFERENCES entities(entity_id)
      );

      CREATE INDEX IF NOT EXISTS idx_obs_entity ON observations(entity_id);
      CREATE INDEX IF NOT EXISTS idx_obs_agent ON observations(source_agent_id);
      CREATE INDEX IF NOT EXISTS idx_obs_confidence ON observations(confidence);
      CREATE INDEX IF NOT EXISTS idx_obs_forgotten ON observations(forgotten_at);
      CREATE INDEX IF NOT EXISTS idx_obs_receipt ON observations(source_receipt_id);

      CREATE TABLE IF NOT EXISTS relationships (
        relationship_id TEXT PRIMARY KEY,
        from_entity_id TEXT NOT NULL,
        to_entity_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        strength TEXT NOT NULL DEFAULT 'medium',
        source_receipt_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        forgotten_at TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (from_entity_id) REFERENCES entities(entity_id),
        FOREIGN KEY (to_entity_id) REFERENCES entities(entity_id)
      );

      CREATE INDEX IF NOT EXISTS idx_rel_from ON relationships(from_entity_id);
      CREATE INDEX IF NOT EXISTS idx_rel_to ON relationships(to_entity_id);
      CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(relationship_type);
    `)

    // FTS table — created separately to handle already-exists gracefully
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
          content,
          content='observations',
          content_rowid='rowid',
          tokenize='porter unicode61'
        );
      `)
    } catch {
      // FTS table may already exist with different config — that's fine
    }

    // FTS sync triggers
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
        INSERT INTO observations_fts(rowid, content) VALUES (new.rowid, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
        INSERT INTO observations_fts(observations_fts, rowid, content) VALUES('delete', old.rowid, old.content);
      END;

      CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
        INSERT INTO observations_fts(observations_fts, rowid, content) VALUES('delete', old.rowid, old.content);
        INSERT INTO observations_fts(rowid, content) VALUES (new.rowid, new.content);
      END;
    `)
  }

  // --- Entities ---

  createEntity(entity: Entity): Entity {
    this.db.prepare(`
      INSERT INTO entities (entity_id, entity_type, name, aliases, scope, created_at,
        created_by_agent, created_by_receipt, forgotten_at, merged_into, attributes, metadata)
      VALUES (@entity_id, @entity_type, @name, @aliases, @scope, @created_at,
        @created_by_agent, @created_by_receipt, @forgotten_at, @merged_into, @attributes, @metadata)
    `).run({
      entity_id: entity.entity_id,
      entity_type: entity.entity_type,
      name: entity.name,
      aliases: JSON.stringify(entity.aliases),
      scope: entity.scope,
      created_at: entity.created_at,
      created_by_agent: entity.created_by_agent,
      created_by_receipt: entity.created_by_receipt,
      forgotten_at: entity.forgotten_at,
      merged_into: entity.merged_into,
      attributes: JSON.stringify(entity.attributes),
      metadata: JSON.stringify(entity.metadata),
    })
    return entity
  }

  getEntity(entityId: string): Entity | null {
    const row = this.db.prepare('SELECT * FROM entities WHERE entity_id = ?').get(entityId) as Record<string, unknown> | undefined
    if (!row) return null
    return this.rowToEntity(row)
  }

  findEntityByName(name: string, entityType: EntityType): Entity | null {
    const row = this.db.prepare(
      'SELECT * FROM entities WHERE name = ? AND entity_type = ? AND forgotten_at IS NULL AND merged_into IS NULL'
    ).get(name, entityType) as Record<string, unknown> | undefined
    if (!row) return null
    return this.rowToEntity(row)
  }

  findEntities(query: MemoryQuery): PaginatedResult<Entity> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (!query.include_forgotten) {
      conditions.push('forgotten_at IS NULL')
      conditions.push('merged_into IS NULL')
    }
    if (query.entity_type) {
      conditions.push('entity_type = ?')
      params.push(query.entity_type)
    }
    if (query.scope) {
      conditions.push('scope = ?')
      params.push(query.scope)
    }
    if (query.agent_id) {
      conditions.push('created_by_agent = ?')
      params.push(query.agent_id)
    }
    if (query.query) {
      conditions.push('(name LIKE ? OR aliases LIKE ?)')
      const pattern = `%${query.query}%`
      params.push(pattern, pattern)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = query.limit ?? 20
    const page = query.page ?? 1
    const offset = (page - 1) * limit

    const countRow = this.db.prepare(`SELECT COUNT(*) as cnt FROM entities ${where}`).get(...params) as { cnt: number }
    const total = countRow.cnt
    const totalPages = Math.max(1, Math.ceil(total / limit))

    const rows = this.db.prepare(
      `SELECT * FROM entities ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as Record<string, unknown>[]

    return {
      data: rows.map(r => this.rowToEntity(r)),
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

  updateEntity(entityId: string, updates: Partial<Entity>): Entity {
    const existing = this.getEntity(entityId)
    if (!existing) throw new Error(`Entity not found: ${entityId}`)

    const updated = { ...existing, ...updates }
    this.db.prepare(`
      UPDATE entities SET
        name = @name, aliases = @aliases, scope = @scope,
        attributes = @attributes, metadata = @metadata,
        forgotten_at = @forgotten_at, merged_into = @merged_into
      WHERE entity_id = @entity_id
    `).run({
      entity_id: entityId,
      name: updated.name,
      aliases: JSON.stringify(updated.aliases),
      scope: updated.scope,
      attributes: JSON.stringify(updated.attributes),
      metadata: JSON.stringify(updated.metadata),
      forgotten_at: updated.forgotten_at,
      merged_into: updated.merged_into,
    })

    return this.getEntity(entityId)!
  }

  forgetEntity(entityId: string, agentId: string): void {
    const now = new Date().toISOString()
    this.db.prepare('UPDATE entities SET forgotten_at = ? WHERE entity_id = ?').run(now, entityId)
    this.db.prepare('UPDATE observations SET forgotten_at = ?, forgotten_by = ? WHERE entity_id = ? AND forgotten_at IS NULL')
      .run(now, agentId, entityId)
  }

  mergeEntities(sourceId: string, targetId: string): Entity {
    const source = this.getEntity(sourceId)
    const target = this.getEntity(targetId)
    if (!source) throw new Error(`Source entity not found: ${sourceId}`)
    if (!target) throw new Error(`Target entity not found: ${targetId}`)

    // Move observations to target
    this.db.prepare('UPDATE observations SET entity_id = ? WHERE entity_id = ?').run(targetId, sourceId)

    // Move relationships to target
    this.db.prepare('UPDATE relationships SET from_entity_id = ? WHERE from_entity_id = ?').run(targetId, sourceId)
    this.db.prepare('UPDATE relationships SET to_entity_id = ? WHERE to_entity_id = ?').run(targetId, sourceId)

    // Merge aliases
    const mergedAliases = [...new Set([...target.aliases, source.name, ...source.aliases])]
    this.db.prepare('UPDATE entities SET aliases = ? WHERE entity_id = ?').run(JSON.stringify(mergedAliases), targetId)

    // Mark source as merged
    this.db.prepare('UPDATE entities SET merged_into = ?, forgotten_at = ? WHERE entity_id = ?')
      .run(targetId, new Date().toISOString(), sourceId)

    return this.getEntity(targetId)!
  }

  // --- Observations ---

  addObservation(obs: Observation): Observation {
    this.db.prepare(`
      INSERT INTO observations (observation_id, entity_id, content, confidence,
        source_receipt_id, source_agent_id, source_context, observed_at,
        forgotten_at, forgotten_by, superseded_by, tags, metadata)
      VALUES (@observation_id, @entity_id, @content, @confidence,
        @source_receipt_id, @source_agent_id, @source_context, @observed_at,
        @forgotten_at, @forgotten_by, @superseded_by, @tags, @metadata)
    `).run({
      observation_id: obs.observation_id,
      entity_id: obs.entity_id,
      content: obs.content,
      confidence: obs.confidence,
      source_receipt_id: obs.source_receipt_id,
      source_agent_id: obs.source_agent_id,
      source_context: obs.source_context,
      observed_at: obs.observed_at,
      forgotten_at: obs.forgotten_at,
      forgotten_by: obs.forgotten_by,
      superseded_by: obs.superseded_by,
      tags: JSON.stringify(obs.tags),
      metadata: JSON.stringify(obs.metadata),
    })
    return obs
  }

  getObservation(observationId: string): Observation | null {
    const row = this.db.prepare('SELECT * FROM observations WHERE observation_id = ?').get(observationId) as Record<string, unknown> | undefined
    if (!row) return null
    return this.rowToObservation(row)
  }

  getObservations(entityId: string, includeForgotten = false): Observation[] {
    const where = includeForgotten
      ? 'WHERE entity_id = ?'
      : 'WHERE entity_id = ? AND forgotten_at IS NULL'
    const rows = this.db.prepare(
      `SELECT * FROM observations ${where} ORDER BY observed_at DESC`
    ).all(entityId) as Record<string, unknown>[]
    return rows.map(r => this.rowToObservation(r))
  }

  forgetObservation(obsId: string, agentId: string): void {
    const now = new Date().toISOString()
    this.db.prepare('UPDATE observations SET forgotten_at = ?, forgotten_by = ? WHERE observation_id = ?')
      .run(now, agentId, obsId)
  }

  supersede(oldObsId: string, newObs: Observation): Observation {
    this.db.prepare('UPDATE observations SET superseded_by = ? WHERE observation_id = ?')
      .run(newObs.observation_id, oldObsId)
    return this.addObservation(newObs)
  }

  // --- Relationships ---

  addRelationship(rel: Relationship): Relationship {
    this.db.prepare(`
      INSERT INTO relationships (relationship_id, from_entity_id, to_entity_id,
        relationship_type, strength, source_receipt_id, created_at, forgotten_at, metadata)
      VALUES (@relationship_id, @from_entity_id, @to_entity_id,
        @relationship_type, @strength, @source_receipt_id, @created_at, @forgotten_at, @metadata)
    `).run({
      relationship_id: rel.relationship_id,
      from_entity_id: rel.from_entity_id,
      to_entity_id: rel.to_entity_id,
      relationship_type: rel.relationship_type,
      strength: rel.strength,
      source_receipt_id: rel.source_receipt_id,
      created_at: rel.created_at,
      forgotten_at: rel.forgotten_at,
      metadata: JSON.stringify(rel.metadata),
    })
    return rel
  }

  getRelationships(entityId: string): Relationship[] {
    const rows = this.db.prepare(
      'SELECT * FROM relationships WHERE (from_entity_id = ? OR to_entity_id = ?) AND forgotten_at IS NULL ORDER BY created_at DESC'
    ).all(entityId, entityId) as Record<string, unknown>[]
    return rows.map(r => this.rowToRelationship(r))
  }

  forgetRelationship(relId: string): void {
    const now = new Date().toISOString()
    this.db.prepare('UPDATE relationships SET forgotten_at = ? WHERE relationship_id = ?').run(now, relId)
  }

  // --- Search ---

  search(query: string, filters?: MemoryQuery): SearchResult[] {
    const limit = filters?.limit ?? 20
    let results: SearchResult[]

    try {
      // Try FTS search first
      const ftsRows = this.db.prepare(`
        SELECT o.*, observations_fts.rank
        FROM observations_fts
        JOIN observations o ON o.rowid = observations_fts.rowid
        WHERE observations_fts MATCH ?
          AND o.forgotten_at IS NULL
        ORDER BY rank
        LIMIT ?
      `).all(query, limit) as Array<Record<string, unknown> & { rank: number }>

      results = ftsRows.map(row => {
        const obs = this.rowToObservation(row)
        const entity = this.getEntity(obs.entity_id)
        return {
          entity: entity!,
          observation: obs,
          rank: row.rank as number,
        }
      }).filter(r => r.entity !== null)
    } catch {
      // Fallback to LIKE search if FTS fails
      const likeRows = this.db.prepare(`
        SELECT * FROM observations
        WHERE content LIKE ? AND forgotten_at IS NULL
        ORDER BY observed_at DESC
        LIMIT ?
      `).all(`%${query}%`, limit) as Record<string, unknown>[]

      results = likeRows.map((row, idx) => {
        const obs = this.rowToObservation(row)
        const entity = this.getEntity(obs.entity_id)
        return {
          entity: entity!,
          observation: obs,
          rank: idx,
        }
      }).filter(r => r.entity !== null)
    }

    // Apply additional filters
    if (filters?.entity_type) {
      results = results.filter(r => r.entity.entity_type === filters.entity_type)
    }
    if (filters?.scope) {
      results = results.filter(r => r.entity.scope === filters.scope)
    }
    if (filters?.confidence_min) {
      const minOrder = CONFIDENCE_ORDER[filters.confidence_min] ?? 0
      results = results.filter(r => (CONFIDENCE_ORDER[r.observation.confidence] ?? 0) >= minOrder)
    }

    return results
  }

  recall(query: MemoryQuery): MemoryRecallResult {
    if (query.query) {
      const results = this.search(query.query, query)
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

    // No text query — use filters
    const entityResult = this.findEntities(query)
    const observations: Observation[] = []
    for (const entity of entityResult.data) {
      const obs = this.getObservations(entity.entity_id, query.include_forgotten)
      observations.push(...obs)
    }

    return {
      entities: entityResult.data,
      observations,
      total: observations.length,
    }
  }

  // --- Audit ---

  getEntityHistory(entityId: string): Observation[] {
    const rows = this.db.prepare(
      'SELECT * FROM observations WHERE entity_id = ? ORDER BY observed_at ASC'
    ).all(entityId) as Record<string, unknown>[]
    return rows.map(r => this.rowToObservation(r))
  }

  getMemoryProvenance(observationId: string): ProvenanceChain | null {
    const obs = this.getObservation(observationId)
    if (!obs) return null

    const entity = this.getEntity(obs.entity_id)
    if (!entity) return null

    // Get the receipt chain — the receipt store handles the chain lookup
    // Here we just return the observation's receipt reference
    return {
      observation: obs,
      entity,
      receipt_id: obs.source_receipt_id,
      chain: [],
    }
  }

  getMemoryStats(agentId?: string, from?: string, to?: string): {
    total_entities: number
    total_observations: number
    total_relationships: number
    forgotten_observations: number
    forgotten_entities: number
    by_entity_type: Record<string, number>
    by_operation: Record<string, number>
  } {
    const entityConditions: string[] = []
    const obsConditions: string[] = []
    const params: unknown[] = []

    if (agentId) {
      entityConditions.push('created_by_agent = ?')
      obsConditions.push('source_agent_id = ?')
      params.push(agentId)
    }

    const entityWhere = entityConditions.length > 0 ? `WHERE ${entityConditions.join(' AND ')}` : ''
    const obsWhere = obsConditions.length > 0 ? `WHERE ${obsConditions.join(' AND ')}` : ''

    const totalEntities = (this.db.prepare(`SELECT COUNT(*) as cnt FROM entities ${entityWhere}`).get(...(agentId ? [agentId] : [])) as { cnt: number }).cnt
    const totalObs = (this.db.prepare(`SELECT COUNT(*) as cnt FROM observations ${obsWhere}`).get(...(agentId ? [agentId] : [])) as { cnt: number }).cnt
    const totalRels = (this.db.prepare('SELECT COUNT(*) as cnt FROM relationships').get() as { cnt: number }).cnt
    const forgottenObs = (this.db.prepare(`SELECT COUNT(*) as cnt FROM observations WHERE forgotten_at IS NOT NULL ${agentId ? 'AND source_agent_id = ?' : ''}`).get(...(agentId ? [agentId] : [])) as { cnt: number }).cnt
    const forgottenEntities = (this.db.prepare(`SELECT COUNT(*) as cnt FROM entities WHERE forgotten_at IS NOT NULL ${agentId ? 'AND created_by_agent = ?' : ''}`).get(...(agentId ? [agentId] : [])) as { cnt: number }).cnt

    const typeRows = this.db.prepare('SELECT entity_type, COUNT(*) as cnt FROM entities GROUP BY entity_type').all() as Array<{ entity_type: string; cnt: number }>
    const byType: Record<string, number> = {}
    for (const r of typeRows) byType[r.entity_type] = r.cnt

    return {
      total_entities: totalEntities,
      total_observations: totalObs,
      total_relationships: totalRels,
      forgotten_observations: forgottenObs,
      forgotten_entities: forgottenEntities,
      by_entity_type: byType,
      by_operation: {},
    }
  }

  // --- Row converters ---

  private rowToEntity(row: Record<string, unknown>): Entity {
    return {
      entity_id: row.entity_id as string,
      entity_type: row.entity_type as EntityType,
      name: row.name as string,
      aliases: JSON.parse(row.aliases as string || '[]') as string[],
      scope: row.scope as MemoryScope,
      created_at: row.created_at as string,
      created_by_agent: row.created_by_agent as string,
      created_by_receipt: row.created_by_receipt as string,
      forgotten_at: (row.forgotten_at as string) || null,
      merged_into: (row.merged_into as string) || null,
      attributes: JSON.parse(row.attributes as string || '{}') as Record<string, unknown>,
      metadata: JSON.parse(row.metadata as string || '{}') as Record<string, unknown>,
    }
  }

  private rowToObservation(row: Record<string, unknown>): Observation {
    return {
      observation_id: row.observation_id as string,
      entity_id: row.entity_id as string,
      content: row.content as string,
      confidence: row.confidence as ConfidenceLevel,
      source_receipt_id: row.source_receipt_id as string,
      source_agent_id: row.source_agent_id as string,
      source_context: (row.source_context as string) || null,
      observed_at: row.observed_at as string,
      forgotten_at: (row.forgotten_at as string) || null,
      forgotten_by: (row.forgotten_by as string) || null,
      superseded_by: (row.superseded_by as string) || null,
      tags: JSON.parse(row.tags as string || '[]') as string[],
      metadata: JSON.parse(row.metadata as string || '{}') as Record<string, unknown>,
    }
  }

  private rowToRelationship(row: Record<string, unknown>): Relationship {
    return {
      relationship_id: row.relationship_id as string,
      from_entity_id: row.from_entity_id as string,
      to_entity_id: row.to_entity_id as string,
      relationship_type: row.relationship_type as string,
      strength: row.strength as ConfidenceLevel,
      source_receipt_id: row.source_receipt_id as string,
      created_at: row.created_at as string,
      forgotten_at: (row.forgotten_at as string) || null,
      metadata: JSON.parse(row.metadata as string || '{}') as Record<string, unknown>,
    }
  }
}
