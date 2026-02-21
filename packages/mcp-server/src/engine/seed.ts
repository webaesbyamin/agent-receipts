import { ReceiptStore } from '../storage/receipt-store.js'
import { KeyManager } from '../storage/key-manager.js'
import { ConfigManager } from '../storage/config-manager.js'
import { ReceiptEngine } from './receipt-engine.js'
import { hashData } from '../hash.js'

export interface SeedOptions {
  count?: number
  clean?: boolean
}

export interface SeedResult {
  total: number
  agents: Record<string, number>
  chains: number
  judgments: number
  constraints: { passed: number; failed: number }
  expired: number
}

const AGENTS = ['agent-alpha', 'agent-beta', 'agent-gamma', 'agent-delta']

const ACTIONS = [
  'code_review', 'generate_code', 'analyze_data', 'summarize_text',
  'translate', 'classify_intent', 'extract_entities', 'search_docs',
  'validate_input', 'optimize_query', 'draft_email', 'parse_json',
  'run_tests', 'deploy_service', 'monitor_health', 'audit_logs',
]

const MODELS = [
  'claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001',
  'gpt-4o', 'gpt-4o-mini', 'gemini-2.0-flash',
]

const TAGS_POOL = [
  'production', 'staging', 'dev', 'critical', 'batch',
  'realtime', 'async', 'retry', 'cached', 'v2',
]

const OUTPUT_SUMMARIES = [
  'Successfully processed request',
  'Generated 3 code suggestions',
  'Analyzed 500 rows of data',
  'Translated document to Spanish',
  'Classified as support_request',
  'Extracted 12 named entities',
  'Found 5 relevant documents',
  'Validated all required fields',
  'Optimized query: 3.2x faster',
  'Draft ready for review',
  'Parsed 45 JSON records',
  'All 12 tests passing',
  'Deployed to production v2.1.0',
  'Health check: all systems nominal',
  'Audit complete: no anomalies',
  'Summarized 3 key findings',
]

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randFloat(min: number, max: number, decimals = 4): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function weightedWeekday(baseDate: Date, dayOffset: number): Date {
  const d = new Date(baseDate)
  d.setDate(d.getDate() - dayOffset)
  // Shift weekends to nearest weekday ~70% of the time
  const dow = d.getDay()
  if ((dow === 0 || dow === 6) && Math.random() < 0.7) {
    d.setDate(d.getDate() + (dow === 0 ? 1 : -1))
  }
  d.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59), randInt(0, 999))
  return d
}

function pickTags(): string[] | undefined {
  if (Math.random() < 0.4) return undefined
  const count = randInt(1, 3)
  const tags: string[] = []
  const pool = [...TAGS_POOL]
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length)
    tags.push(pool.splice(idx, 1)[0]!)
  }
  return tags
}

export async function seedDemoData(
  store: ReceiptStore,
  keyManager: KeyManager,
  options?: SeedOptions,
): Promise<SeedResult> {
  const configManager = new ConfigManager(store['receiptsDir'].replace(/\/receipts$/, ''))
  await configManager.init()
  const engine = new ReceiptEngine(store, keyManager, configManager)

  const targetCount = options?.count ?? randInt(80, 100)
  const now = new Date()

  // Clean existing if requested
  if (options?.clean) {
    const existing = await store.list(undefined, 1, 100000)
    for (const r of existing.data) {
      await store.delete(r.receipt_id)
    }
  }

  const result: SeedResult = {
    total: 0,
    agents: {},
    chains: 0,
    judgments: 0,
    constraints: { passed: 0, failed: 0 },
    expired: 0,
  }

  // Track all created receipts for chain building
  const allReceipts: Array<{ receipt_id: string; chain_id: string; action: string; agent_id: string }> = []

  // Scale phases based on target count
  const isSmall = targetCount < 40
  const judgmentCount = isSmall ? 0 : 4
  const expiredCount = isSmall ? 1 : 3
  const futureCount = isSmall ? 1 : 5
  const reservedCount = judgmentCount + expiredCount + futureCount
  const chainTarget = isSmall ? Math.max(1, Math.floor(targetCount / 10)) : 12
  const avgChainSteps = isSmall ? 3 : 4
  const estimatedChainReceipts = chainTarget * avgChainSteps
  const standaloneCount = Math.max(3, targetCount - reservedCount - estimatedChainReceipts)
  for (let i = 0; i < standaloneCount; i++) {
    const agent = pick(AGENTS)
    const action = pick(ACTIONS)
    const dayOffset = randInt(0, 13)
    const ts = weightedWeekday(now, dayOffset)
    // Add burst: some receipts cluster in recent hours
    if (i < 5) {
      ts.setTime(now.getTime() - randInt(60_000, 3_600_000))
    }
    const model = pick(MODELS)
    const tokensIn = randInt(50, 8000)
    const tokensOut = randInt(20, 4000)
    const latency = randInt(100, 12000)
    const costBase = (tokensIn * 0.000003 + tokensOut * 0.000015)
    const cost = parseFloat(costBase.toFixed(6))

    const useConstraints = Math.random() < 0.4
    const constraints = useConstraints ? buildConstraints(latency, cost) : undefined

    const tags = pickTags()
    const receipt = await engine.track({
      action,
      input: { query: `demo-input-${i}`, context: `batch-${Math.floor(i / 10)}` },
      output: { result: `demo-output-${i}`, items: randInt(1, 20) },
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: cost,
      latency_ms: latency,
      confidence: randFloat(0.6, 0.99),
      tags,
      output_summary: pick(OUTPUT_SUMMARIES),
      constraints,
      metadata: { demo: true, generated_at: ts.toISOString() },
    })

    allReceipts.push({
      receipt_id: receipt.receipt_id,
      chain_id: receipt.chain_id,
      action: receipt.action,
      agent_id: receipt.agent_id,
    })
    result.agents[receipt.agent_id] = (result.agents[receipt.agent_id] ?? 0) + 1
    result.total++

    if (useConstraints && receipt.constraint_result) {
      const cr = receipt.constraint_result as { passed: boolean }
      if (cr.passed) result.constraints.passed++
      else result.constraints.failed++
    }
  }

  // Phase 2: Create chains (3-7 steps each)
  const chainBudget = Math.max(chainTarget * 5, targetCount - standaloneCount - reservedCount)
  const chainCount = chainTarget
  let chainReceiptsUsed = 0
  for (let c = 0; c < chainCount && chainReceiptsUsed < chainBudget; c++) {
    const steps = randInt(3, Math.min(7, chainBudget - chainReceiptsUsed))
    const agent = pick(AGENTS)
    const baseAction = pick(ACTIONS)
    let parentId: string | undefined
    let chainId: string | undefined

    for (let s = 0; s < steps; s++) {
      const dayOffset = randInt(0, 10)
      const latency = randInt(200, 8000)
      const tokensIn = randInt(100, 5000)
      const tokensOut = randInt(50, 3000)
      const cost = parseFloat((tokensIn * 0.000003 + tokensOut * 0.000015).toFixed(6))

      const useConstraints = Math.random() < 0.4
      const constraints = useConstraints ? buildConstraints(latency, cost) : undefined

      const receipt = await engine.track({
        action: `${baseAction}_step${s + 1}`,
        input: { step: s + 1, chain_step: `chain-${c}-step-${s}` },
        output: { step_result: `completed step ${s + 1}` },
        model: pick(MODELS),
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_usd: cost,
        latency_ms: latency,
        confidence: randFloat(0.7, 0.98),
        tags: pickTags(),
        output_summary: `Step ${s + 1} of ${steps} completed`,
        parent_receipt_id: parentId,
        chain_id: chainId,
        constraints,
        metadata: { demo: true },
      })

      if (s === 0) chainId = receipt.chain_id
      parentId = receipt.receipt_id

      allReceipts.push({
        receipt_id: receipt.receipt_id,
        chain_id: receipt.chain_id,
        action: receipt.action,
        agent_id: receipt.agent_id,
      })
      result.agents[receipt.agent_id] = (result.agents[receipt.agent_id] ?? 0) + 1
      result.total++
      chainReceiptsUsed++

      if (useConstraints && receipt.constraint_result) {
        const cr = receipt.constraint_result as { passed: boolean }
        if (cr.passed) result.constraints.passed++
        else result.constraints.failed++
      }
    }
    result.chains++
  }

  // Phase 3: Create judgment receipts
  const judgmentTargets = allReceipts.slice(5, 5 + judgmentCount)
  for (const target of judgmentTargets) {
    const pending = await engine.create({
      receipt_type: 'judgment',
      action: 'judge',
      input_hash: hashData({ receipt_id: target.receipt_id }),
      parent_receipt_id: target.receipt_id,
      chain_id: target.chain_id,
      status: 'pending',
      metadata: { rubric_version: '1.0', demo: true },
    })

    const verdict = pick(['pass', 'pass', 'partial', 'fail'] as const)
    const score = verdict === 'pass' ? randFloat(0.8, 0.98) : verdict === 'partial' ? randFloat(0.5, 0.79) : randFloat(0.2, 0.49)

    await engine.complete(pending.receipt_id, {
      status: 'completed',
      output_hash: hashData({ verdict, score }),
      output_summary: `${verdict.toUpperCase()} (${score.toFixed(2)})`,
      confidence: randFloat(0.75, 0.95),
      metadata: {
        rubric_version: '1.0',
        demo: true,
        judgment: {
          verdict,
          score,
          criteria_results: [
            { criterion: 'accuracy', score: randFloat(0.5, 1.0), passed: Math.random() > 0.3, reasoning: 'Evaluated accuracy of output' },
            { criterion: 'completeness', score: randFloat(0.4, 1.0), passed: Math.random() > 0.3, reasoning: 'Checked completeness of response' },
            { criterion: 'clarity', score: randFloat(0.6, 1.0), passed: Math.random() > 0.2, reasoning: 'Assessed clarity and readability' },
          ],
          overall_reasoning: `Evaluation of ${target.action}: ${verdict === 'pass' ? 'Meets quality standards' : verdict === 'partial' ? 'Partially meets standards, improvements needed' : 'Does not meet minimum quality threshold'}`,
          rubric_version: '1.0',
        },
      },
    })

    result.total += 2 // pending + completed count as 1 receipt, but we created 2 operations on 1
    result.judgments++
  }
  // Correct: each judgment is 1 receipt (create + complete), not 2
  result.total = result.total - judgmentCount

  // Phase 4: Create expired receipts
  for (let i = 0; i < expiredCount; i++) {
    const daysAgo = randInt(2, 7)
    const expiredAt = new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
    await engine.track({
      action: pick(ACTIONS),
      input: { expired_demo: i },
      output: { result: 'expired result' },
      model: pick(MODELS),
      tokens_in: randInt(100, 2000),
      tokens_out: randInt(50, 1000),
      cost_usd: randFloat(0.0001, 0.01),
      latency_ms: randInt(200, 5000),
      expires_at: expiredAt,
      metadata: { demo: true },
    })
    result.total++
    result.expired++
  }

  // Phase 5: Create future-expiring receipts
  for (let i = 0; i < futureCount; i++) {
    const daysAhead = randInt(1, 30)
    const expiresAt = new Date(now.getTime() + daysAhead * 86_400_000).toISOString()
    await engine.track({
      action: pick(ACTIONS),
      input: { future_expiry_demo: i },
      output: { result: 'future expiring result' },
      model: pick(MODELS),
      tokens_in: randInt(100, 3000),
      tokens_out: randInt(50, 1500),
      cost_usd: randFloat(0.0001, 0.02),
      latency_ms: randInt(150, 6000),
      expires_at: expiresAt,
      tags: ['expiring'],
      metadata: { demo: true },
    })
    result.total++
  }

  return result
}

function buildConstraints(latencyMs: number, costUsd: number) {
  const constraints: Array<{ type: string; value: unknown }> = []

  // max_latency_ms: ~30% chance of failing
  const latencyThreshold = Math.random() < 0.3 ? Math.floor(latencyMs * 0.5) : Math.floor(latencyMs * 2)
  constraints.push({ type: 'max_latency_ms', value: latencyThreshold })

  // max_cost_usd: ~20% chance of failing
  if (Math.random() < 0.6) {
    const costThreshold = Math.random() < 0.2 ? costUsd * 0.5 : costUsd * 3
    constraints.push({ type: 'max_cost_usd', value: parseFloat(costThreshold.toFixed(6)) })
  }

  // min_confidence: sometimes
  if (Math.random() < 0.3) {
    constraints.push({ type: 'min_confidence', value: randFloat(0.6, 0.9) })
  }

  return constraints
}
