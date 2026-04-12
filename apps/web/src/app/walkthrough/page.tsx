'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Brain,
  Eye,
  ShieldCheck,
  Package,
  Play,
  ArrowRight,
  ArrowLeft,
  Check,
  Download,
  ChevronRight,
} from 'lucide-react'
import { useInteractive } from '@/lib/interactive-context'
import { generateWalkthroughBundle, downloadBundle } from '@/lib/generate-bundle'

// ─── Step Indicator ─────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: 'Learn', icon: Brain },
  { num: 2, label: 'Build', icon: Eye },
  { num: 3, label: 'Recall', icon: Brain },
  { num: 4, label: 'Verify', icon: ShieldCheck },
  { num: 5, label: 'Export', icon: Package },
]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-8">
      {STEPS.map((step, i) => {
        const completed = current > step.num
        const active = current === step.num
        const Icon = step.icon
        return (
          <div key={step.num} className="flex items-center gap-2 sm:gap-3">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  completed
                    ? 'bg-success text-white'
                    : active
                      ? 'bg-primary text-white'
                      : 'bg-bg-tertiary text-text-muted'
                }`}
              >
                {completed ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className={`text-xs hidden sm:block ${active ? 'text-primary font-medium' : 'text-text-muted'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-6 sm:w-10 h-0.5 rounded ${
                  current > step.num ? 'bg-success' : 'bg-bg-tertiary'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: An Agent Learns About You ──────────────────────────────────────

function Step1() {
  const ctx = useInteractive()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [interest, setInterest] = useState('')
  const [executed, setExecuted] = useState(false)

  const handleStore = useCallback(() => {
    ctx.setVisitorInfo(name, role, interest)
    ctx.executeStep(1)
    setExecuted(true)
  }, [ctx, name, role, interest])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-2">An Agent Learns About You</h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          When an AI agent interacts with you, it can store observations as cryptographically signed memories.
          Fill in a few details and watch the agent create your first memory entry.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
          <input
            type="text"
            placeholder="e.g. Alex Chen"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-bg-primary text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            disabled={executed}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Role</label>
          <input
            type="text"
            placeholder="e.g. Frontend Engineer"
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-bg-primary text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            disabled={executed}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Interest</label>
          <input
            type="text"
            placeholder="e.g. AI accountability"
            value={interest}
            onChange={e => setInterest(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-bg-primary text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            disabled={executed}
          />
        </div>
      </div>

      {!executed && (
        <button
          onClick={handleStore}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Play className="w-4 h-4" />
          Store Memory
        </button>
      )}

      {executed && (
        <div className="space-y-4 animate-in fade-in">
          {/* Entity card */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-text-primary">Entity Created</span>
            </div>
            {ctx.entities[0] && (
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-text-muted w-20 shrink-0">Name</span>
                  <span className="text-text-primary font-medium">{ctx.entities[0].name}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-text-muted w-20 shrink-0">Type</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-bg-tertiary text-text-secondary">
                    {ctx.entities[0].entity_type}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-text-muted w-20 shrink-0">ID</span>
                  <code className="font-mono text-xs text-text-secondary">{ctx.entities[0].entity_id}</code>
                </div>
              </div>
            )}
          </div>

          {/* Observation */}
          {ctx.observations[0] && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-text-primary">Observation Stored</span>
              </div>
              <p className="text-sm text-text-secondary italic">&ldquo;{ctx.observations[0].content}&rdquo;</p>
            </div>
          )}

          {/* Receipt preview */}
          {ctx.receipts[0] && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-text-primary">Receipt</span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-success-subtle text-success font-medium">
                  <ShieldCheck className="w-3 h-3" />
                  Signed
                </span>
              </div>
              <div className="space-y-1 text-xs font-mono text-text-muted">
                <div>receipt_id: {ctx.receipts[0].receipt_id}</div>
                <div>action: {ctx.receipts[0].action}</div>
                <div>signature: {ctx.receipts[0].signature.slice(0, 40)}...</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Memory Builds Up ───────────────────────────────────────────────

function Step2() {
  const ctx = useInteractive()
  const [executed, setExecuted] = useState(false)

  const handleAdd = useCallback(() => {
    ctx.executeStep(2)
    setExecuted(true)
  }, [ctx])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Memory Builds Up</h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          As the agent continues working, it accumulates observations about you and the projects you touch.
          Each observation is individually signed and linked to its source receipt.
        </p>
      </div>

      {!executed && (
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Eye className="w-4 h-4" />
          Add More Observations
        </button>
      )}

      {executed && (
        <div className="space-y-4">
          {/* Observation list */}
          <div className="card">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium text-text-primary">
                Observations ({ctx.observations.length})
              </h3>
            </div>
            <div className="divide-y divide-border-subtle">
              {ctx.observations.map(obs => (
                <div key={obs.observation_id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-text-secondary">{obs.content}</p>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-bg-tertiary text-text-muted shrink-0">
                      {obs.confidence}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
                    <code className="font-mono">{obs.observation_id}</code>
                    {obs.tags.map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 rounded bg-bg-tertiary">{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Entities */}
          <div className="card">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium text-text-primary">
                Entities ({ctx.entities.length})
              </h3>
            </div>
            <div className="divide-y divide-border-subtle">
              {ctx.entities.map(ent => (
                <div key={ent.entity_id} className="px-4 py-3 flex items-center gap-3">
                  <Brain className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-text-primary">{ent.name}</span>
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-bg-tertiary text-text-secondary">
                      {ent.entity_type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Relationships */}
          {ctx.relationships.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-text-primary">Relationship Discovered</span>
              </div>
              {ctx.relationships.map(rel => (
                <div key={rel.relationship_id} className="text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">
                    {ctx.entities.find(e => e.entity_id === rel.from_entity_id)?.name}
                  </span>
                  {' '}
                  <span className="px-2 py-0.5 rounded bg-primary-subtle text-primary text-xs font-mono">
                    {rel.relationship_type}
                  </span>
                  {' '}
                  <span className="font-medium text-text-primary">
                    {ctx.entities.find(e => e.entity_id === rel.to_entity_id)?.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 3: A New Session Starts ───────────────────────────────────────────

function Step3() {
  const ctx = useInteractive()
  const [executed, setExecuted] = useState(false)

  const handleLoad = useCallback(() => {
    ctx.executeStep(3)
    setExecuted(true)
  }, [ctx])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-2">A New Session Starts</h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          When a new session begins, the agent calls <code className="px-1 py-0.5 rounded bg-bg-tertiary text-text-secondary text-xs font-mono">memory.context</code> to
          load everything it knows. The response is a structured dump of entities, observations, and relationships
          — all backed by signed receipts.
        </p>
      </div>

      {!executed && (
        <button
          onClick={handleLoad}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Brain className="w-4 h-4" />
          Load Context
        </button>
      )}

      {executed && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-bg-secondary">
            <span className="text-xs font-mono text-text-muted">memory.context response</span>
          </div>
          <div className="p-4 overflow-x-auto">
            <pre className="text-xs font-mono text-text-secondary leading-relaxed whitespace-pre-wrap">
{JSON.stringify(
  {
    entities: ctx.entities.map(e => ({
      entity_id: e.entity_id,
      name: e.name,
      type: e.entity_type,
      attributes: e.attributes,
    })),
    observations: ctx.observations.map(o => ({
      observation_id: o.observation_id,
      entity_id: o.entity_id,
      content: o.content,
      confidence: o.confidence,
    })),
    relationships: ctx.relationships.map(r => ({
      from: ctx.entities.find(e => e.entity_id === r.from_entity_id)?.name,
      to: ctx.entities.find(e => e.entity_id === r.to_entity_id)?.name,
      type: r.relationship_type,
    })),
    receipts_count: ctx.receipts.length,
  },
  null,
  2
)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 4: Verify the Proof ───────────────────────────────────────────────

function Step4() {
  const ctx = useInteractive()
  const sampleReceipt = ctx.receipts[0]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Verify the Proof</h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          Every receipt is Ed25519 signed. The 12 signable fields are serialized as canonical JSON and signed
          with the agent&apos;s private key. Anyone with the public key can verify the receipt is authentic and
          untampered.
        </p>
      </div>

      {sampleReceipt && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-bg-secondary flex items-center justify-between">
            <span className="text-xs font-mono text-text-muted">Receipt JSON</span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-success-subtle text-success font-medium">
              <ShieldCheck className="w-3 h-3" />
              Signed
            </span>
          </div>
          <div className="p-4 overflow-x-auto">
            <pre className="text-xs font-mono text-text-secondary leading-relaxed whitespace-pre-wrap">
{JSON.stringify(
  {
    receipt_id: sampleReceipt.receipt_id,
    chain_id: sampleReceipt.chain_id,
    receipt_type: sampleReceipt.receipt_type,
    agent_id: sampleReceipt.agent_id,
    action: sampleReceipt.action,
    status: sampleReceipt.status,
    timestamp: sampleReceipt.timestamp,
    signature: sampleReceipt.signature,
    verify_url: sampleReceipt.verify_url,
  },
  null,
  2
)}
            </pre>
          </div>
        </div>
      )}

      <Link
        href="/verify"
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
      >
        <ShieldCheck className="w-4 h-4" />
        Go to Verify Page
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

// ─── Step 5: Take Your Memories With You ────────────────────────────────────

function Step5() {
  const ctx = useInteractive()
  const [downloaded, setDownloaded] = useState(false)
  const [bundleStats, setBundleStats] = useState<{
    entities: number
    observations: number
    relationships: number
    receipts: number
    size: string
  } | null>(null)

  const handleDownload = useCallback(async () => {
    const json = await generateWalkthroughBundle(
      ctx.entities,
      ctx.observations,
      ctx.relationships,
      ctx.receipts
    )
    downloadBundle(json)
    setBundleStats({
      entities: ctx.entities.length,
      observations: ctx.observations.length,
      relationships: ctx.relationships.length,
      receipts: ctx.receipts.length,
      size: `${(new Blob([json]).size / 1024).toFixed(1)} KB`,
    })
    setDownloaded(true)
  }, [ctx])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Take Your Memories With You</h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          Memory bundles are portable JSON files containing all entities, observations, relationships, and their
          signed receipts. Export them for backup, auditing, or transferring to another agent.
          The bundle includes a SHA-256 checksum for integrity verification.
        </p>
      </div>

      <button
        onClick={handleDownload}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
      >
        <Download className="w-4 h-4" />
        {downloaded ? 'Download Again' : 'Download Memory Bundle'}
      </button>

      {bundleStats && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-success" />
            <span className="text-sm font-medium text-text-primary">Bundle Downloaded</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Entities', value: bundleStats.entities },
              { label: 'Observations', value: bundleStats.observations },
              { label: 'Relationships', value: bundleStats.relationships },
              { label: 'Receipts', value: bundleStats.receipts },
              { label: 'Size', value: bundleStats.size },
            ].map(s => (
              <div key={s.label} className="text-center px-3 py-2 rounded-md bg-bg-secondary">
                <div className="text-lg font-semibold text-text-primary">{s.value}</div>
                <div className="text-xs text-text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Completion Screen ──────────────────────────────────────────────────────

function CompletionScreen() {
  const ctx = useInteractive()

  return (
    <div className="text-center space-y-8 py-8">
      <div>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-subtle mb-4">
          <ShieldCheck className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">
          That&apos;s accountable AI memory.
        </h2>
        <p className="text-text-secondary text-sm max-w-md mx-auto leading-relaxed">
          Every observation signed. Every memory verifiable. Every bundle portable.
          You generated {ctx.receipts.length} receipts, {ctx.entities.length} entities, and{' '}
          {ctx.observations.length} observations in this walkthrough.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          Explore Dashboard
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/memory"
          className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-md text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
        >
          See Your Memories
          <ChevronRight className="w-4 h-4" />
        </Link>
        <Link
          href="/get-started"
          className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-md text-sm font-medium text-text-primary hover:bg-bg-secondary transition-colors"
        >
          Install in 30 Seconds
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <button
        onClick={ctx.resetWalkthrough}
        className="text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        Reset and start over
      </button>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

function WalkthroughContent() {
  const ctx = useInteractive()

  // Not started — show intro
  if (!ctx.isActive) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-subtle mb-6">
          <Play className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-3">
          See Agent Receipts in Action
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed mb-8 max-w-md mx-auto">
          Walk through how an AI agent stores verifiable, cryptographically signed memories — step by step,
          in about 60 seconds. No setup required.
        </p>
        <button
          onClick={ctx.startWalkthrough}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          <Play className="w-4 h-4" />
          Start Walkthrough
        </button>
      </div>
    )
  }

  // Completed
  if (ctx.isComplete) {
    return (
      <div className="max-w-2xl mx-auto px-4">
        <CompletionScreen />
      </div>
    )
  }

  // Active step
  const stepComponents: Record<number, React.ReactNode> = {
    1: <Step1 />,
    2: <Step2 />,
    3: <Step3 />,
    4: <Step4 />,
    5: <Step5 />,
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      <StepIndicator current={ctx.currentStep} />

      <div className="mb-8">
        {stepComponents[ctx.currentStep]}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          onClick={ctx.prevStep}
          disabled={ctx.currentStep <= 1}
          className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </button>
        <span className="text-xs text-text-muted">Step {ctx.currentStep} of 5</span>
        <button
          onClick={ctx.nextStep}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          {ctx.currentStep >= 5 ? 'Finish' : 'Next'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function WalkthroughPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-start justify-center py-8">
      <WalkthroughContent />
    </div>
  )
}
