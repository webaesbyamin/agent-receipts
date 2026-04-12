'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

// ─── Types matching @agent-receipts/schema ──────────────────────────────────

interface WalkthroughEntity {
  entity_id: string
  entity_type: 'person' | 'project' | 'organization' | 'preference' | 'fact' | 'context' | 'tool' | 'custom'
  name: string
  aliases: string[]
  scope: 'agent' | 'user' | 'team' | 'global'
  created_at: string
  created_by_agent: string
  created_by_receipt: string
  forgotten_at: string | null
  merged_into: string | null
  attributes: Record<string, unknown>
  metadata: Record<string, unknown>
}

interface WalkthroughObservation {
  observation_id: string
  entity_id: string
  content: string
  confidence: 'certain' | 'high' | 'medium' | 'low' | 'deprecated'
  source_receipt_id: string
  source_agent_id: string
  source_context: string | null
  observed_at: string
  forgotten_at: string | null
  forgotten_by: string | null
  superseded_by: string | null
  expires_at: string | null
  tags: string[]
  metadata: Record<string, unknown>
}

interface WalkthroughRelationship {
  relationship_id: string
  from_entity_id: string
  to_entity_id: string
  relationship_type: string
  strength: 'certain' | 'high' | 'medium' | 'low' | 'deprecated'
  source_receipt_id: string
  created_at: string
  forgotten_at: string | null
  metadata: Record<string, unknown>
}

interface WalkthroughReceipt {
  receipt_id: string
  parent_receipt_id: string | null
  chain_id: string
  receipt_type: 'memory'
  agent_id: string
  org_id: string
  action: string
  input_hash: string
  output_hash: string | null
  output_summary: string | null
  model: string | null
  tokens_in: number | null
  tokens_out: number | null
  cost_usd: number | null
  latency_ms: number | null
  tool_calls: string[] | null
  timestamp: string
  completed_at: string | null
  status: 'completed'
  error: Record<string, unknown> | null
  environment: 'development' | 'production' | 'staging' | 'test'
  tags: string[] | null
  constraints: Record<string, unknown> | null
  constraint_result: Record<string, unknown> | null
  signature: string
  verify_url: string
  callback_verified: boolean | null
  confidence: number | null
  metadata: Record<string, unknown>
}

// ─── Context Shape ──────────────────────────────────────────────────────────

interface InteractiveState {
  currentStep: number
  isActive: boolean
  isComplete: boolean
  entities: WalkthroughEntity[]
  observations: WalkthroughObservation[]
  receipts: WalkthroughReceipt[]
  relationships: WalkthroughRelationship[]
  visitorName: string
  visitorRole: string
  visitorInterest: string
  startWalkthrough: () => void
  nextStep: () => void
  prevStep: () => void
  resetWalkthrough: () => void
  setVisitorInfo: (name: string, role: string, interest: string) => void
  executeStep: (step: number) => void
  getEntities: () => WalkthroughEntity[]
  getObservations: (entityId?: string) => WalkthroughObservation[]
  getReceipts: () => WalkthroughReceipt[]
}

const InteractiveContext = createContext<InteractiveState | null>(null)

// ─── Helpers ────────────────────────────────────────────────────────────────

let counter = 0
function uid(prefix: string): string {
  counter++
  return `${prefix}_wt_${Date.now().toString(36)}_${counter}`
}

function now(): string {
  return new Date().toISOString()
}

function makeReceipt(action: string, chainId: string, summary: string): WalkthroughReceipt {
  const id = uid('rcpt')
  return {
    receipt_id: id,
    parent_receipt_id: null,
    chain_id: chainId,
    receipt_type: 'memory',
    agent_id: 'walkthrough-agent',
    org_id: 'demo-org',
    action,
    input_hash: `sha256:${id.slice(0, 16)}`,
    output_hash: `sha256:${id.slice(0, 12)}out`,
    output_summary: summary,
    model: 'claude-sonnet-4-20250514',
    tokens_in: 120 + Math.floor(Math.random() * 200),
    tokens_out: 80 + Math.floor(Math.random() * 150),
    cost_usd: parseFloat((0.001 + Math.random() * 0.005).toFixed(4)),
    latency_ms: 150 + Math.floor(Math.random() * 300),
    tool_calls: ['memory_observe'],
    timestamp: now(),
    completed_at: now(),
    status: 'completed',
    error: null,
    environment: 'development',
    tags: ['walkthrough'],
    constraints: null,
    constraint_result: null,
    signature: 'ed25519:DEMO_WALKTHROUGH_SIGNATURE',
    verify_url: `https://agentreceipts.dev/verify/${id}`,
    callback_verified: null,
    confidence: 0.95,
    metadata: {},
  }
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function InteractiveProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isActive, setIsActive] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [entities, setEntities] = useState<WalkthroughEntity[]>([])
  const [observations, setObservations] = useState<WalkthroughObservation[]>([])
  const [receipts, setReceipts] = useState<WalkthroughReceipt[]>([])
  const [relationships, setRelationships] = useState<WalkthroughRelationship[]>([])
  const [visitorName, setVisitorName] = useState('')
  const [visitorRole, setVisitorRole] = useState('')
  const [visitorInterest, setVisitorInterest] = useState('')

  const startWalkthrough = useCallback(() => {
    setIsActive(true)
    setCurrentStep(1)
  }, [])

  const nextStep = useCallback(() => {
    setCurrentStep(s => {
      if (s >= 5) {
        setIsComplete(true)
        return 6
      }
      return s + 1
    })
  }, [])

  const prevStep = useCallback(() => {
    setCurrentStep(s => Math.max(1, s - 1))
  }, [])

  const resetWalkthrough = useCallback(() => {
    counter = 0
    setCurrentStep(0)
    setIsActive(false)
    setIsComplete(false)
    setEntities([])
    setObservations([])
    setReceipts([])
    setRelationships([])
    setVisitorName('')
    setVisitorRole('')
    setVisitorInterest('')
  }, [])

  const setVisitorInfo = useCallback((name: string, role: string, interest: string) => {
    setVisitorName(name)
    setVisitorRole(role)
    setVisitorInterest(interest)
  }, [])

  const executeStep = useCallback((step: number) => {
    const chainId = `chain_wt_${Date.now().toString(36)}`
    const ts = now()

    if (step === 1) {
      // Create person entity + observation + receipt
      const entityId = uid('ent')
      const receiptId = uid('rcpt')
      const obsId = uid('obs')

      const entity: WalkthroughEntity = {
        entity_id: entityId,
        entity_type: 'person',
        name: visitorName || 'Visitor',
        aliases: [visitorName?.toLowerCase().replace(/\s+/g, '-') || 'visitor'],
        scope: 'user',
        created_at: ts,
        created_by_agent: 'walkthrough-agent',
        created_by_receipt: receiptId,
        forgotten_at: null,
        merged_into: null,
        attributes: { role: visitorRole || 'explorer', interest: visitorInterest || 'AI accountability' },
        metadata: {},
      }

      const observation: WalkthroughObservation = {
        observation_id: obsId,
        entity_id: entityId,
        content: `${visitorName || 'Visitor'} is a ${visitorRole || 'developer'} interested in ${visitorInterest || 'AI accountability'}`,
        confidence: 'high',
        source_receipt_id: receiptId,
        source_agent_id: 'walkthrough-agent',
        source_context: 'interactive-walkthrough',
        observed_at: ts,
        forgotten_at: null,
        forgotten_by: null,
        superseded_by: null,
        expires_at: null,
        tags: ['walkthrough', 'intro'],
        metadata: {},
      }

      const receipt = makeReceipt('memory.observe', chainId, `Created entity for ${visitorName || 'Visitor'}`)
      receipt.receipt_id = receiptId

      setEntities(prev => [...prev, entity])
      setObservations(prev => [...prev, observation])
      setReceipts(prev => [...prev, receipt])
    }

    if (step === 2) {
      // Create 3 more observations + project entity + relationship + receipts
      const personEntity = entities[0]
      const personEntityId = personEntity?.entity_id ?? uid('ent')

      const projectEntityId = uid('ent')
      const projectReceiptId = uid('rcpt')

      const projectEntity: WalkthroughEntity = {
        entity_id: projectEntityId,
        entity_type: 'project',
        name: 'Agent Receipts',
        aliases: ['agent-receipts', 'ar'],
        scope: 'team',
        created_at: ts,
        created_by_agent: 'walkthrough-agent',
        created_by_receipt: projectReceiptId,
        forgotten_at: null,
        merged_into: null,
        attributes: { language: 'TypeScript', framework: 'Next.js' },
        metadata: {},
      }

      const obs1: WalkthroughObservation = {
        observation_id: uid('obs'),
        entity_id: personEntityId,
        content: `Prefers ${visitorRole?.includes('design') ? 'visual explanations' : 'code examples'} when learning new tools`,
        confidence: 'medium',
        source_receipt_id: uid('rcpt'),
        source_agent_id: 'walkthrough-agent',
        source_context: 'interactive-walkthrough',
        observed_at: ts,
        forgotten_at: null,
        forgotten_by: null,
        superseded_by: null,
        expires_at: null,
        tags: ['walkthrough', 'preference'],
        metadata: {},
      }

      const obs2: WalkthroughObservation = {
        observation_id: uid('obs'),
        entity_id: personEntityId,
        content: `Currently exploring the interactive walkthrough for Agent Receipts`,
        confidence: 'certain',
        source_receipt_id: uid('rcpt'),
        source_agent_id: 'walkthrough-agent',
        source_context: 'interactive-walkthrough',
        observed_at: ts,
        forgotten_at: null,
        forgotten_by: null,
        superseded_by: null,
        expires_at: null,
        tags: ['walkthrough', 'activity'],
        metadata: {},
      }

      const obs3: WalkthroughObservation = {
        observation_id: uid('obs'),
        entity_id: projectEntityId,
        content: 'Agent Receipts provides cryptographic proof for AI agent actions using Ed25519 signatures',
        confidence: 'certain',
        source_receipt_id: projectReceiptId,
        source_agent_id: 'walkthrough-agent',
        source_context: 'interactive-walkthrough',
        observed_at: ts,
        forgotten_at: null,
        forgotten_by: null,
        superseded_by: null,
        expires_at: null,
        tags: ['walkthrough', 'description'],
        metadata: {},
      }

      const rel: WalkthroughRelationship = {
        relationship_id: uid('rel'),
        from_entity_id: personEntityId,
        to_entity_id: projectEntityId,
        relationship_type: 'interested_in',
        strength: 'high',
        source_receipt_id: projectReceiptId,
        created_at: ts,
        forgotten_at: null,
        metadata: {},
      }

      const r1 = makeReceipt('memory.observe', chainId, 'Added learning preference observation')
      const r2 = makeReceipt('memory.observe', chainId, 'Tracked walkthrough activity')
      const r3 = makeReceipt('memory.observe', chainId, 'Created project entity for Agent Receipts')

      setEntities(prev => [...prev, projectEntity])
      setObservations(prev => [...prev, obs1, obs2, obs3])
      setRelationships(prev => [...prev, rel])
      setReceipts(prev => [...prev, r1, r2, r3])
    }

    if (step === 3) {
      // memory.context receipt — display step
      const receipt = makeReceipt('memory.context', chainId, `Loaded context: ${entities.length} entities, ${observations.length} observations, ${relationships.length} relationships`)
      receipt.action = 'memory.context'
      setReceipts(prev => [...prev, receipt])
    }

    // Steps 4 and 5 are display-only, no data generated
  }, [entities, observations, relationships, visitorName, visitorRole, visitorInterest])

  const getEntities = useCallback(() => entities, [entities])
  const getObservations = useCallback((entityId?: string) => {
    if (entityId) return observations.filter(o => o.entity_id === entityId)
    return observations
  }, [observations])
  const getReceipts = useCallback(() => receipts, [receipts])

  return (
    <InteractiveContext.Provider
      value={{
        currentStep,
        isActive,
        isComplete,
        entities,
        observations,
        receipts,
        relationships,
        visitorName,
        visitorRole,
        visitorInterest,
        startWalkthrough,
        nextStep,
        prevStep,
        resetWalkthrough,
        setVisitorInfo,
        executeStep,
        getEntities,
        getObservations,
        getReceipts,
      }}
    >
      {children}
    </InteractiveContext.Provider>
  )
}

export function useInteractive(): InteractiveState {
  const ctx = useContext(InteractiveContext)
  if (!ctx) {
    throw new Error('useInteractive must be used within an InteractiveProvider')
  }
  return ctx
}
