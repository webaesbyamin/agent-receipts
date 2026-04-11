import { z } from 'zod'

// --- Enums ---

export const EntityType = z.enum([
  'person',
  'project',
  'organization',
  'preference',
  'fact',
  'context',
  'tool',
  'custom',
])
export type EntityType = z.infer<typeof EntityType>

export const MemoryOperation = z.enum([
  'observe',
  'create',
  'merge',
  'forget',
  'forget_entity',
  'recall',
  'update',
])
export type MemoryOperation = z.infer<typeof MemoryOperation>

export const MemoryScope = z.enum([
  'agent',
  'user',
  'team',
  'global',
])
export type MemoryScope = z.infer<typeof MemoryScope>

export const ConfidenceLevel = z.enum([
  'certain',
  'high',
  'medium',
  'low',
  'deprecated',
])
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>

// --- Core Types ---

export const Observation = z.object({
  observation_id: z.string(),
  entity_id: z.string(),
  content: z.string(),
  confidence: ConfidenceLevel.default('medium'),
  source_receipt_id: z.string(),
  source_agent_id: z.string(),
  source_context: z.string().nullable(),
  observed_at: z.string().datetime(),
  forgotten_at: z.string().datetime().nullable(),
  forgotten_by: z.string().nullable(),
  superseded_by: z.string().nullable(),
  expires_at: z.string().datetime().nullable().default(null),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
})
export type Observation = z.infer<typeof Observation>

export const Relationship = z.object({
  relationship_id: z.string(),
  from_entity_id: z.string(),
  to_entity_id: z.string(),
  relationship_type: z.string(),
  strength: ConfidenceLevel.default('medium'),
  source_receipt_id: z.string(),
  created_at: z.string().datetime(),
  forgotten_at: z.string().datetime().nullable(),
  metadata: z.record(z.unknown()).default({}),
})
export type Relationship = z.infer<typeof Relationship>

export const Entity = z.object({
  entity_id: z.string(),
  entity_type: EntityType,
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  scope: MemoryScope.default('agent'),
  created_at: z.string().datetime(),
  created_by_agent: z.string(),
  created_by_receipt: z.string(),
  forgotten_at: z.string().datetime().nullable(),
  merged_into: z.string().nullable(),
  attributes: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
})
export type Entity = z.infer<typeof Entity>

// --- Memory Receipt Extension ---

export const MemoryReceiptPayload = z.object({
  memory_operation: MemoryOperation,
  entity_id: z.string().nullable(),
  observation_id: z.string().nullable(),
  relationship_id: z.string().nullable(),
  scope: MemoryScope,
  query: z.string().nullable(),
  results_count: z.number().int().nullable(),
  confidence: ConfidenceLevel.nullable(),
})
export type MemoryReceiptPayload = z.infer<typeof MemoryReceiptPayload>

// --- Query Types ---

export const MemoryQuery = z.object({
  query: z.string().optional(),
  entity_type: EntityType.optional(),
  entity_id: z.string().optional(),
  scope: MemoryScope.optional(),
  agent_id: z.string().optional(),
  confidence_min: ConfidenceLevel.optional(),
  include_forgotten: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
})
export type MemoryQuery = z.infer<typeof MemoryQuery>
