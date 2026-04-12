import { readFile, writeFile, mkdir, chmod, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { version: CLI_VERSION } = require('../package.json')
import {
  ReceiptStore,
  KeyManager,
  ConfigManager,
  ReceiptEngine,
  MemoryStore,
  MemoryEngine,
  formatInvoiceJSON,
  formatInvoiceCSV,
  formatInvoiceMarkdown,
  formatInvoiceHTML,
  seedDemoData,
} from '@agent-receipts/mcp-server'
import type { InvoiceOptions } from '@agent-receipts/mcp-server'
import { verifyReceipt, getSignablePayload, getPublicKeyFromPrivate } from '@agent-receipts/crypto'

const HELP = `
agent-receipts — CLI for managing Agent Receipts

Usage:
  agent-receipts <command> [options]

Commands:
  init                              Create data directory and generate signing keys
  keys [--export] [--import <hex>]  Display, export, or import signing keys
  inspect <id|file>                 Pretty-print a receipt
  verify <id|file> [--key <hex>]    Verify a receipt's signature
  list [options]                    List receipts
  chain <chain_id> [--tree]         Show all receipts in a chain
  judgments <receipt_id> [--json]    Show judgments for a receipt
  cleanup [--dry-run]               Delete expired receipts
  stats                             Show aggregate receipt statistics
  export <id> | --all [--pretty]    Export receipt(s) as JSON to stdout
  invoice [options]                 Generate an invoice from receipts
  seed [--demo] [--clean] [--count <n>]  Seed demo data for testing
  watch [options]                   Watch for new receipts in real-time
  prompts <client>                  Show setup guide (claude-code, cursor, system)
  memory <subcommand>               Memory module commands

Memory subcommands:
  memory context                            Get structured memory context summary
  memory observe <entity> <type> <content>  Store an observation
  memory recall [query]                     Search memories
  memory entities [--type <t>]              List all entities
  memory forget <id>                        Forget an observation or entity
  memory audit                              Print memory audit report
  memory provenance <obs_id>                Print provenance chain
  memory export                             Export all memories as JSON
  memory import <file>                      Import memories from JSON

List options:
  --agent <id>                Filter by agent ID
  --status <status>           Filter by status (pending|completed|failed|timeout)
  --failed                    Show only receipts with failed constraints
  --passed                    Show only receipts with passed constraints
  --limit <n>                 Limit results (default: 50)
  --json                      Output as JSON

Invoice options:
  --from <date>               Start date (required, ISO 8601)
  --to <date>                 End date (required, ISO 8601)
  --client <name>             Client/bill-to name
  --provider <name>           Provider/from name
  --format <fmt>              Output format: html, json, csv, md (default: html)
  --output <path>             Output file path (default: invoice-{number}.html)
  --group-by <key>            Group by: action, agent, day, none (default: none)
  --agent <id>                Filter by agent ID (can repeat)
  --notes <text>              Notes to include on the invoice
  --payment-terms <text>      Payment terms (e.g. "Net 30")

General:
  --help, -h                  Show this help
  --version, -v               Show version
`.trim()

async function getEngine(dataDir?: string) {
  const dir = dataDir ?? ConfigManager.getDefaultDataDir()
  const store = new ReceiptStore(dir)
  await store.init()
  const keyManager = new KeyManager(dir)
  await keyManager.init()
  const configManager = new ConfigManager(dir)
  await configManager.init()
  return { engine: new ReceiptEngine(store, keyManager, configManager), keyManager, configManager, store, dataDir: dir }
}

async function getMemoryEngine(dataDir?: string) {
  const { engine, store, configManager, ...rest } = await getEngine(dataDir)
  const memoryStore = new MemoryStore(store.getDb())
  memoryStore.init()
  const memoryEngine = new MemoryEngine(engine, memoryStore)
  const config = configManager.getConfig()
  return { engine, memoryEngine, memoryStore, agentId: config.agentId, ...rest }
}

async function cmdMemory(subArgs: string[]) {
  const sub = subArgs[0]
  if (!sub) {
    console.error('Usage: agent-receipts memory <subcommand>')
    console.error('Subcommands: observe, recall, entities, forget, audit, provenance, export, import')
    process.exit(1)
  }

  const { memoryEngine, memoryStore, agentId } = await getMemoryEngine()

  switch (sub) {
    case 'observe': {
      const entityName = subArgs[1]
      const entityType = subArgs[2]
      const content = subArgs[3]
      if (!entityName || !entityType || !content) {
        console.error('Usage: agent-receipts memory observe <entity_name> <entity_type> <content>')
        process.exit(1)
      }
      const validTypes = ['person', 'project', 'organization', 'preference', 'fact', 'context', 'tool', 'custom'] as const
      if (!validTypes.includes(entityType as typeof validTypes[number])) {
        console.error(`Invalid entity type: ${entityType}. Must be one of: ${validTypes.join(', ')}`)
        process.exit(1)
      }
      const ttlIdx = subArgs.indexOf('--ttl')
      const ttlSeconds = ttlIdx >= 0 ? parseInt(subArgs[ttlIdx + 1], 10) : undefined
      const result = await memoryEngine.observe({
        entityName,
        entityType: entityType as typeof validTypes[number],
        content,
        agentId,
        ttlSeconds,
      })
      console.log(`Observed: ${result.observation.observation_id}`)
      console.log(`  Entity: ${result.entity.name} (${result.entity.entity_id})`)
      console.log(`  Content: ${content}`)
      if (result.observation.expires_at) console.log(`  Expires: ${result.observation.expires_at}`)
      console.log(`  Receipt: ${result.receipt.receipt_id}`)
      if (result.created_entity) console.log('  (new entity created)')
      break
    }

    case 'recall': {
      const query = subArgs[1]
      const result = await memoryEngine.recall({ query, agentId })
      console.log(`Recall: ${result.observations.length} observations across ${result.entities.length} entities`)
      for (const entity of result.entities) {
        console.log(`\n  ${entity.name} [${entity.entity_type}]`)
        const entityObs = result.observations.filter(o => o.entity_id === entity.entity_id)
        for (const obs of entityObs) {
          console.log(`    - ${obs.content} (${obs.confidence})`)
        }
      }
      if (result.receipt) console.log(`\nReceipt: ${result.receipt.receipt_id}`)
      break
    }

    case 'entities': {
      const typeIdx = subArgs.indexOf('--type')
      const entityType = typeIdx >= 0 ? subArgs[typeIdx + 1] : undefined
      const result = memoryStore.findEntities({
        entity_type: entityType as ReturnType<typeof memoryStore.findEntities>['data'][number]['entity_type'],
        include_forgotten: subArgs.includes('--forgotten'),
        limit: 50,
        page: 1,
      })
      console.log(`Entities: ${result.pagination.total} total`)
      for (const e of result.data) {
        const obsCount = memoryStore.getObservations(e.entity_id, false).length
        console.log(`  ${e.entity_id}  ${e.name.padEnd(20)}  ${e.entity_type.padEnd(14)}  ${obsCount} obs`)
      }
      break
    }

    case 'forget': {
      const id = subArgs[1]
      if (!id) {
        console.error('Usage: agent-receipts memory forget <entity_id|observation_id>')
        process.exit(1)
      }
      const reason = subArgs.includes('--reason') ? subArgs[subArgs.indexOf('--reason') + 1] : undefined
      const params = id.startsWith('ent_')
        ? { entityId: id, agentId, reason }
        : { observationId: id, agentId, reason }
      const result = await memoryEngine.forget(params)
      console.log(`Forgotten: ${id}`)
      console.log(`Receipt: ${result.receipt.receipt_id}`)
      break
    }

    case 'audit': {
      const report = memoryEngine.memoryAudit({})
      console.log('Memory Audit Report')
      console.log(`  Entities: ${report.total_entities}`)
      console.log(`  Observations: ${report.total_observations}`)
      console.log(`  Relationships: ${report.total_relationships}`)
      console.log(`  Forgotten observations: ${report.forgotten_observations}`)
      console.log(`  Forgotten entities: ${report.forgotten_entities}`)
      if (Object.keys(report.by_entity_type).length > 0) {
        console.log('  By type:')
        for (const [type, count] of Object.entries(report.by_entity_type)) {
          console.log(`    ${type}: ${count}`)
        }
      }
      break
    }

    case 'provenance': {
      const obsId = subArgs[1]
      if (!obsId) {
        console.error('Usage: agent-receipts memory provenance <observation_id>')
        process.exit(1)
      }
      const prov = memoryEngine.provenance(obsId)
      if (!prov) {
        console.log(`Observation not found: ${obsId}`)
        break
      }
      console.log(`Provenance for ${obsId}`)
      console.log(`  Entity: ${prov.entity.name} (${prov.entity.entity_id})`)
      console.log(`  Content: ${prov.observation.content}`)
      console.log(`  Agent: ${prov.observation.source_agent_id}`)
      console.log(`  Observed: ${prov.observation.observed_at}`)
      console.log(`  Receipt: ${prov.receipt_id}`)
      if (prov.observation.source_context) {
        console.log(`  Context: ${prov.observation.source_context}`)
      }
      break
    }

    case 'context': {
      const scopeIdx = subArgs.indexOf('--scope')
      const ctxScope = scopeIdx >= 0 ? subArgs[scopeIdx + 1] as 'agent' | 'user' | 'team' : undefined
      const maxEntIdx = subArgs.indexOf('--max-entities')
      const maxEnt = maxEntIdx >= 0 ? parseInt(subArgs[maxEntIdx + 1], 10) : undefined
      const result = await memoryEngine.getContext({ scope: ctxScope, maxEntities: maxEnt })
      console.log(`Memory Context (${result.stats.total_entities} entities, ${result.stats.total_observations} observations)`)
      console.log('')
      if (result.entities.length > 0) {
        console.log('Top Entities:')
        for (const e of result.entities) {
          console.log(`  ${e.name} [${e.entity_type}] — ${e.observation_count} observations`)
        }
      }
      if (result.preferences.length > 0) {
        console.log('')
        console.log('Preferences:')
        for (const p of result.preferences) {
          console.log(`  - ${p.content} (${p.confidence})`)
        }
      }
      if (result.relationships.length > 0) {
        console.log('')
        console.log(`Relationships: ${result.relationships.length}`)
        for (const r of result.relationships) {
          console.log(`  ${r.from_entity_id} → ${r.relationship_type} → ${r.to_entity_id}`)
        }
      }
      console.log('')
      if (result.receipt) console.log(`Receipt: ${result.receipt.receipt_id}`)
      break
    }

    case 'export': {
      const allEntities = memoryStore.findEntities({ include_forgotten: true, limit: 100, page: 1 })
      const exported: Record<string, unknown>[] = []
      for (const entity of allEntities.data) {
        const observations = memoryStore.getObservations(entity.entity_id, true)
        const relationships = memoryStore.getRelationships(entity.entity_id)
        exported.push({ entity, observations, relationships })
      }
      console.log(JSON.stringify(exported, null, 2))
      break
    }

    case 'import': {
      const filePath = subArgs[1]
      if (!filePath) {
        console.error('Usage: agent-receipts memory import <file>')
        process.exit(1)
      }
      const raw = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw) as Array<{ entity: Record<string, unknown>; observations: Record<string, unknown>[] }>
      let entityCount = 0
      let obsCount = 0
      for (const item of data) {
        try {
          memoryStore.createEntity(item.entity as Parameters<typeof memoryStore.createEntity>[0])
          entityCount++
        } catch {
          // Entity may already exist
        }
        for (const obs of item.observations) {
          try {
            memoryStore.addObservation(obs as Parameters<typeof memoryStore.addObservation>[0])
            obsCount++
          } catch {
            // Observation may already exist
          }
        }
      }
      console.log(`Imported ${entityCount} entities and ${obsCount} observations`)
      break
    }

    default:
      console.error(`Unknown memory subcommand: ${sub}`)
      process.exit(1)
  }
}

async function cmdInit() {
  const { keyManager } = await getEngine()
  console.log('Initialized Agent Receipts data directory')
  console.log(`Public key: ${keyManager.getPublicKey()}`)
}

async function cmdKeys(args: string[]) {
  if (args.includes('--import')) {
    const importIdx = args.indexOf('--import')
    const hex = args[importIdx + 1]
    if (!hex) {
      console.error('Usage: agent-receipts keys --import <hex>')
      process.exit(1)
    }
    if (!/^[a-f0-9]{64}$/i.test(hex)) {
      console.error('Invalid key: must be 64 hex characters (32 bytes)')
      process.exit(1)
    }

    const dataDir = ConfigManager.getDefaultDataDir()
    const keysDir = join(dataDir, 'keys')
    const privateKeyPath = join(keysDir, 'private.key')

    // Check if keys already exist
    let keysExist = false
    try {
      await stat(privateKeyPath)
      keysExist = true
    } catch {
      // Does not exist
    }

    if (keysExist) {
      if (process.stdin.isTTY) {
        const answer = await new Promise<string>((resolve) => {
          const rl = createInterface({ input: process.stdin, output: process.stdout })
          rl.question('Keys already exist. Overwrite? (y/N) ', (ans) => {
            rl.close()
            resolve(ans)
          })
        })
        if (answer.toLowerCase() !== 'y') {
          console.log('Aborted.')
          return
        }
      } else {
        console.error('Keys already exist. Use interactive terminal to overwrite.')
        process.exit(1)
      }
    }

    const publicKey = getPublicKeyFromPrivate(hex)
    await mkdir(keysDir, { recursive: true })
    await writeFile(privateKeyPath, hex, { encoding: 'utf-8', mode: 0o600 })
    await chmod(privateKeyPath, 0o600)
    await writeFile(join(keysDir, 'public.key'), publicKey, 'utf-8')

    console.log(`Keys imported successfully. Public key: ${publicKey}`)
    return
  }

  const { keyManager } = await getEngine()
  const publicKey = keyManager.getPublicKey()
  if (args.includes('--export')) {
    console.log(JSON.stringify({ algorithm: 'Ed25519', public_key: publicKey, format: 'hex' }, null, 2))
  } else {
    console.log(`Public key: ${publicKey}`)
  }
}

async function cmdInspect(target: string) {
  let receipt
  if (target.endsWith('.json') || target.includes('/')) {
    const data = await readFile(target, 'utf-8')
    receipt = JSON.parse(data)
  } else {
    const { engine } = await getEngine()
    receipt = await engine.get(target)
    if (!receipt) {
      console.error(`Receipt not found: ${target}`)
      process.exit(1)
    }
  }

  console.log(`Receipt: ${receipt.receipt_id}`)
  console.log(`  Chain:    ${receipt.chain_id}`)
  console.log(`  Action:   ${receipt.action}`)
  console.log(`  Status:   ${receipt.status}`)
  console.log(`  Agent:    ${receipt.agent_id}`)
  console.log(`  Time:     ${receipt.timestamp}`)
  if (receipt.completed_at) console.log(`  Completed: ${receipt.completed_at}`)

  // Show expires_at if present
  const expiresAt = (receipt.metadata as Record<string, unknown>)?.expires_at as string | undefined
  if (expiresAt) {
    const expiresDate = new Date(expiresAt)
    const now = new Date()
    const diffMs = expiresDate.getTime() - now.getTime()
    if (diffMs <= 0) {
      const agoMs = -diffMs
      const agoDays = Math.floor(agoMs / (1000 * 60 * 60 * 24))
      const agoStr = agoDays > 0 ? `${agoDays} day${agoDays !== 1 ? 's' : ''} ago` : 'just now'
      console.log(`  Expires:  ${expiresAt} (EXPIRED — ${agoStr})`)
    } else {
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      const remainStr = days > 0 ? `${days} day${days !== 1 ? 's' : ''} remaining` : 'less than a day remaining'
      console.log(`  Expires:  ${expiresAt} (${remainStr})`)
    }
  }

  if (receipt.model) console.log(`  Model:    ${receipt.model}`)
  if (receipt.latency_ms != null) console.log(`  Latency:  ${receipt.latency_ms}ms`)
  if (receipt.cost_usd != null) console.log(`  Cost:     $${receipt.cost_usd}`)
  console.log(`  Input:    ${receipt.input_hash}`)
  if (receipt.output_hash) console.log(`  Output:   ${receipt.output_hash}`)
  if (receipt.output_summary) console.log(`  Summary:  ${receipt.output_summary}`)
  console.log(`  Signature: ${receipt.signature.slice(0, 30)}...`)

  // Show constraint results if present
  if (receipt.constraint_result && typeof receipt.constraint_result === 'object' && 'passed' in receipt.constraint_result) {
    const cr = receipt.constraint_result as { passed: boolean; results: Array<{ type: string; passed: boolean; expected: unknown; actual: unknown; message?: string }> }
    const passedCount = cr.results.filter((r) => r.passed).length
    const totalCount = cr.results.length
    console.log(`  Constraints: ${passedCount}/${totalCount} ${cr.passed ? 'PASSED' : 'FAILED'}`)
    for (const r of cr.results) {
      const icon = r.passed ? '\u2713' : '\u2717'
      const expectedStr = formatExpected(r.type, r.expected)
      const status = r.passed ? '' : '    FAILED'
      console.log(`    ${icon} ${r.type.padEnd(18)} expected: ${expectedStr}   actual: ${r.actual}${status}`)
    }
  }
}

function formatExpected(type: string, expected: unknown): string {
  if (type === 'max_latency_ms' || type === 'max_cost_usd') return `\u2264${expected}`
  if (type === 'min_confidence') return `\u2265${expected}`
  return String(expected)
}

async function cmdVerify(target: string, args: string[]) {
  let receipt
  if (target.endsWith('.json') || target.includes('/')) {
    const data = await readFile(target, 'utf-8')
    receipt = JSON.parse(data)
  } else {
    const { engine } = await getEngine()
    receipt = await engine.get(target)
    if (!receipt) {
      console.error(`Receipt not found: ${target}`)
      process.exit(1)
    }
  }

  const keyIdx = args.indexOf('--key')
  let publicKey: string
  if (keyIdx !== -1 && args[keyIdx + 1] !== undefined) {
    publicKey = args[keyIdx + 1] as string
  } else {
    const { keyManager } = await getEngine()
    publicKey = keyManager.getPublicKey()
  }

  const signable = getSignablePayload(receipt)
  const verified = verifyReceipt(signable, receipt.signature, publicKey)

  if (verified) {
    console.log(`Verified: ${receipt.receipt_id}`)
    console.log(`Public key: ${publicKey}`)
  } else {
    console.error(`FAILED: ${receipt.receipt_id} — signature invalid`)
    process.exit(1)
  }
}

async function cmdList(args: string[]) {
  const { engine } = await getEngine()
  const filter: Record<string, string> = {}
  const isJson = args.includes('--json')
  const filterFailed = args.includes('--failed')
  const filterPassed = args.includes('--passed')
  let limit = 50

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = args[i + 1]
    if (arg === '--agent' && next) { filter['agent_id'] = next; i++ }
    if (arg === '--status' && next) { filter['status'] = next; i++ }
    if (arg === '--limit' && next) { limit = parseInt(next, 10); i++ }
  }

  const result = await engine.list(filter, 1, limit)

  // Post-filter by constraint result
  let filtered = result.data
  if (filterFailed) {
    filtered = filtered.filter((r) => {
      const cr = r.constraint_result as { passed: boolean } | null
      return cr && !cr.passed
    })
  } else if (filterPassed) {
    filtered = filtered.filter((r) => {
      const cr = r.constraint_result as { passed: boolean } | null
      return cr && cr.passed
    })
  }

  if (isJson) {
    console.log(JSON.stringify({ ...result, data: filtered }, null, 2))
  } else {
    console.log(`Receipts (${filtered.length} total):`)
    for (const r of filtered) {
      const status = r.status.padEnd(9)
      console.log(`  ${r.receipt_id}  ${status}  ${r.action}  ${r.timestamp}`)
    }
  }
}

async function cmdChain(chainId: string, args: string[]) {
  const { engine } = await getEngine()
  const receipts = await engine.getChain(chainId)
  if (receipts.length === 0) {
    console.log(`No receipts found for chain: ${chainId}`)
    return
  }

  if (args.includes('--tree')) {
    console.log(`Chain: ${chainId} (${receipts.length} receipts)`)

    // Build parent-child map
    type Receipt = typeof receipts[number]
    const childrenOf = new Map<string, Receipt[]>()
    const roots: Receipt[] = []

    for (const r of receipts) {
      const parentId = r.parent_receipt_id
      if (!parentId || !receipts.some((p) => p.receipt_id === parentId)) {
        roots.push(r)
      } else {
        const siblings = childrenOf.get(parentId) ?? []
        siblings.push(r)
        childrenOf.set(parentId, siblings)
      }
    }

    function renderTree(node: Receipt, prefix: string, isLast: boolean): void {
      const connector = isLast ? '└─' : '├─'
      const ts = node.timestamp.replace('T', ' ').replace(/\.\d+Z$/, '')
      console.log(`${prefix}${connector} ${node.receipt_id} ${node.action} [${node.status}] ${ts}`)
      const children = childrenOf.get(node.receipt_id) ?? []
      for (let i = 0; i < children.length; i++) {
        const child = children[i]!
        const childPrefix = prefix + (isLast ? '   ' : '│  ')
        renderTree(child, childPrefix, i === children.length - 1)
      }
    }

    for (let i = 0; i < roots.length; i++) {
      renderTree(roots[i]!, '', i === roots.length - 1)
    }
    return
  }

  console.log(`Chain: ${chainId} (${receipts.length} receipts)`)
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i]!
    console.log(`  ${i + 1}. ${r.receipt_id}  ${r.status.padEnd(9)}  ${r.action}  ${r.timestamp}`)
  }
}

async function cmdStats() {
  const { engine } = await getEngine()
  const all = await engine.list(undefined, 1, 10000)
  const receipts = all.data

  const byStatus: Record<string, number> = {}
  const byAction: Record<string, number> = {}
  let constraintsPassed = 0
  let constraintsFailed = 0
  for (const r of receipts) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    byAction[r.action] = (byAction[r.action] ?? 0) + 1
    if (r.constraint_result && typeof r.constraint_result === 'object' && 'passed' in r.constraint_result) {
      if ((r.constraint_result as { passed: boolean }).passed) {
        constraintsPassed++
      } else {
        constraintsFailed++
      }
    }
  }

  console.log(`Total receipts: ${receipts.length}`)
  console.log(`By status:`)
  for (const [s, c] of Object.entries(byStatus)) {
    console.log(`  ${s}: ${c}`)
  }
  console.log(`By action:`)
  for (const [a, c] of Object.entries(byAction)) {
    console.log(`  ${a}: ${c}`)
  }
  if (constraintsPassed + constraintsFailed > 0) {
    console.log(`Constraints:`)
    console.log(`  passed: ${constraintsPassed}`)
    console.log(`  failed: ${constraintsFailed}`)
  }
}

async function cmdJudgments(receiptId: string, args: string[]) {
  const { engine } = await getEngine()
  const isJson = args.includes('--json')
  const judgments = await engine.getJudgments(receiptId)

  if (isJson) {
    console.log(JSON.stringify({
      receipt_id: receiptId,
      count: judgments.length,
      judgments: judgments.map(j => ({
        judgment_id: j.receipt_id,
        verdict: (j.metadata as Record<string, unknown>)?.judgment
          ? ((j.metadata as Record<string, unknown>).judgment as Record<string, unknown>).verdict
          : null,
        score: (j.metadata as Record<string, unknown>)?.judgment
          ? ((j.metadata as Record<string, unknown>).judgment as Record<string, unknown>).score
          : null,
        status: j.status,
        output_summary: j.output_summary,
        confidence: j.confidence,
        timestamp: j.timestamp,
      })),
    }, null, 2))
    return
  }

  if (judgments.length === 0) {
    console.log(`No judgments found for ${receiptId}`)
    return
  }

  console.log(`Judgments for ${receiptId} (${judgments.length} found)`)
  for (const j of judgments) {
    const judgment = (j.metadata as Record<string, unknown>)?.judgment as Record<string, unknown> | undefined
    const verdict = judgment?.verdict as string ?? 'unknown'
    const score = judgment?.score as number ?? 0
    const criteriaResults = judgment?.criteria_results as Array<{ criterion: string; score: number; passed: boolean; reasoning: string }> | undefined

    console.log('')
    console.log(`  Judgment: ${j.receipt_id}`)
    console.log(`  Verdict:  ${verdict.toUpperCase()} (${score.toFixed(2)})`)
    console.log(`  Judge:    ${j.agent_id}`)
    console.log(`  Date:     ${j.completed_at ?? j.timestamp}`)

    if (criteriaResults && criteriaResults.length > 0) {
      console.log('')
      console.log('  Criteria:')
      for (const cr of criteriaResults) {
        const icon = cr.passed ? '\u2713' : '\u2717'
        console.log(`    ${icon} ${cr.criterion.padEnd(15)} ${cr.score.toFixed(2)}  ${cr.reasoning}`)
      }
    }

    const overallReasoning = judgment?.overall_reasoning as string | undefined
    if (overallReasoning) {
      console.log('')
      console.log(`  Overall: ${overallReasoning}`)
    }
  }
}

async function cmdCleanup(args: string[]) {
  const isDryRun = args.includes('--dry-run')
  const { engine } = await getEngine()

  if (isDryRun) {
    const all = await engine.list(undefined, 1, 100000)
    const now = new Date().toISOString()
    const expired = all.data.filter(r => {
      const ea = (r.metadata as Record<string, unknown>)?.expires_at as string | undefined
      return ea && ea < now
    })

    console.log('Scanning receipts...')
    if (expired.length === 0) {
      console.log('\nNo expired receipts found.')
      return
    }
    console.log(`\nExpired: ${expired.length} receipt${expired.length !== 1 ? 's' : ''}`)
    for (const r of expired) {
      const ea = (r.metadata as Record<string, unknown>)?.expires_at as string
      console.log(`  ${r.receipt_id}  ${r.action.padEnd(20)} expired ${ea}`)
    }
    console.log(`\n(dry run — no receipts deleted)`)
    return
  }

  const result = await engine.cleanup()
  if (result.deleted === 0) {
    console.log('No expired receipts found.')
  } else {
    console.log(`Deleted ${result.deleted} expired receipt${result.deleted !== 1 ? 's' : ''}. ${result.remaining} remaining.`)
  }
}

async function cmdExport(target: string, args: string[]) {
  const { engine } = await getEngine()
  const isPretty = args.includes('--pretty')
  if (target === '--all' || args.includes('--all')) {
    const result = await engine.list(undefined, 1, 10000)
    const sorted = result.data.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    console.log(JSON.stringify(sorted, null, isPretty ? 2 : undefined))
  } else {
    const receipt = await engine.get(target)
    if (!receipt) {
      console.error(`Receipt not found: ${target}`)
      process.exit(1)
    }
    console.log(JSON.stringify(receipt, null, 2))
  }
}

async function cmdInvoice(args: string[]) {
  let from: string | undefined
  let to: string | undefined
  let clientName: string | undefined
  let providerName: string | undefined
  let format = 'html'
  let outputPath: string | undefined
  let groupBy: 'action' | 'agent' | 'day' | 'none' = 'none'
  const agentIds: string[] = []
  let notes: string | undefined
  let paymentTerms: string | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = args[i + 1]
    if (arg === '--from' && next) { from = next; i++ }
    else if (arg === '--to' && next) { to = next; i++ }
    else if (arg === '--client' && next) { clientName = next; i++ }
    else if (arg === '--provider' && next) { providerName = next; i++ }
    else if (arg === '--format' && next) { format = next; i++ }
    else if (arg === '--output' && next) { outputPath = next; i++ }
    else if (arg === '--group-by' && next) { groupBy = next as typeof groupBy; i++ }
    else if (arg === '--agent' && next) { agentIds.push(next); i++ }
    else if (arg === '--notes' && next) { notes = next; i++ }
    else if (arg === '--payment-terms' && next) { paymentTerms = next; i++ }
  }

  if (!from || !to) {
    console.error('Usage: agent-receipts invoice --from <date> --to <date> [options]')
    process.exit(1)
  }

  const { engine } = await getEngine()
  const options: InvoiceOptions = {
    from,
    to,
    group_by: groupBy,
    agent_ids: agentIds.length > 0 ? agentIds : undefined,
    notes,
    payment_terms: paymentTerms,
  }

  if (clientName) options.client = { name: clientName }
  if (providerName) options.provider = { name: providerName }

  const invoice = await engine.generateInvoice(options)

  if (format === 'html') {
    const html = formatInvoiceHTML(invoice)
    const outFile = outputPath ?? `invoice-${invoice.invoice_number}.html`
    await writeFile(outFile, html, 'utf-8')
    console.log(`Invoice ${invoice.invoice_number} generated`)
    console.log(`  Period: ${invoice.period.from} to ${invoice.period.to}`)
    console.log(`  Receipts: ${invoice.summary.total_receipts}`)
    console.log(`  Total: $${invoice.summary.total_cost_usd.toFixed(4)}`)
    console.log(`  File: ${outFile}`)
  } else if (format === 'json') {
    console.log(formatInvoiceJSON(invoice))
  } else if (format === 'csv') {
    console.log(formatInvoiceCSV(invoice))
  } else if (format === 'md') {
    console.log(formatInvoiceMarkdown(invoice))
  } else {
    console.error(`Unknown format: ${format}. Use html, json, csv, or md.`)
    process.exit(1)
  }
}

async function cmdSeed(args: string[]) {
  const isDemo = args.includes('--demo')
  const isClean = args.includes('--clean')
  let count: number | undefined

  const countIdx = args.indexOf('--count')
  if (countIdx !== -1 && args[countIdx + 1]) {
    count = parseInt(args[countIdx + 1]!, 10)
    if (isNaN(count) || count < 1) {
      console.error('Invalid count: must be a positive integer')
      process.exit(1)
    }
  }

  if (!isDemo && !count) {
    console.error('Usage: agent-receipts seed --demo [--clean] [--count <n>]')
    process.exit(1)
  }

  const dir = process.env['AGENT_RECEIPTS_DATA_DIR'] ?? ConfigManager.getDefaultDataDir()
  const store = new ReceiptStore(dir)
  await store.init()
  const keyManager = new KeyManager(dir)
  await keyManager.init()

  if (isClean) {
    if (process.stdin.isTTY) {
      const answer = await new Promise<string>((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout })
        rl.question('Delete all existing receipts? (y/N) ', (ans) => {
          rl.close()
          resolve(ans)
        })
      })
      if (answer.toLowerCase() !== 'y') {
        console.log('Aborted.')
        return
      }
    }
  }

  console.log('Seeding demo data...')
  const result = await seedDemoData(store, keyManager, { count, clean: isClean })

  console.log(`\nSeeded ${result.total} receipts:`)
  console.log(`  Chains: ${result.chains}`)
  console.log(`  Judgments: ${result.judgments}`)
  console.log(`  Expired: ${result.expired}`)
  console.log(`  Constraints: ${result.constraints.passed} passed, ${result.constraints.failed} failed`)
  console.log(`  Agents:`)
  for (const [agent, c] of Object.entries(result.agents)) {
    console.log(`    ${agent}: ${c}`)
  }
}

async function cmdWatch(args: string[]) {
  const { engine } = await getEngine()
  let agentFilter: string | undefined
  let actionFilter: string | undefined
  let statusFilter: string | undefined
  let interval = 1000

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = args[i + 1]
    if (arg === '--agent' && next) { agentFilter = next; i++ }
    if (arg === '--action' && next) { actionFilter = next; i++ }
    if (arg === '--status' && next) { statusFilter = next; i++ }
    if (arg === '--interval' && next) { interval = parseInt(next, 10); i++ }
  }

  const isTTY = process.stdout.isTTY ?? false
  const green = isTTY ? '\x1b[32m' : ''
  const red = isTTY ? '\x1b[31m' : ''
  const yellow = isTTY ? '\x1b[33m' : ''
  const blue = isTTY ? '\x1b[34m' : ''
  const reset = isTTY ? '\x1b[0m' : ''

  const statusColor = (s: string) => {
    if (s === 'completed') return `${green}${s}${reset}`
    if (s === 'failed') return `${red}${s}${reset}`
    if (s === 'pending') return `${yellow}${s}${reset}`
    return `${blue}${s}${reset}`
  }

  const seen = new Set<string>()
  let count = 0
  let fromTime = new Date().toISOString()

  console.log(`${blue}Watching for new receipts...${reset} (Ctrl+C to stop)`)
  console.log(`${'RECEIPT_ID'.padEnd(18)}  ${'STATUS'.padEnd(12)}  ${'ACTION'.padEnd(22)}  TIMESTAMP`)
  console.log('-'.repeat(80))

  let running = true
  const onSigint = () => {
    running = false
    console.log(`\n${blue}---${reset}`)
    console.log(`Watched ${count} new receipt${count !== 1 ? 's' : ''}.`)
    process.exit(0)
  }
  process.on('SIGINT', onSigint)

  while (running) {
    const filter: Record<string, string> = {}
    if (agentFilter) filter['agent_id'] = agentFilter
    if (actionFilter) filter['action'] = actionFilter
    if (statusFilter) filter['status'] = statusFilter
    filter['from'] = fromTime

    const result = await engine.list(filter, 1, 100, 'timestamp:asc')

    for (const r of result.data) {
      if (seen.has(r.receipt_id)) continue
      seen.add(r.receipt_id)
      count++
      const ts = r.timestamp.replace('T', ' ').replace(/\.\d+Z$/, 'Z')
      console.log(`${r.receipt_id.padEnd(18)}  ${statusColor(r.status).padEnd(12 + (isTTY ? 9 : 0))}  ${r.action.padEnd(22)}  ${ts}`)
    }

    if (result.data.length > 0) {
      fromTime = result.data[result.data.length - 1]!.timestamp
    }

    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

function cmdPrompts(client?: string) {
  const systemPrompt = `## Agent Receipts — Memory & Accountability

You have Agent Receipts connected. It provides cryptographically signed memory and action tracking.

### On Session Start
Call \`memory_context\` to load what you know about this user. If results come back, use them naturally.

### During Conversation
When you learn something worth remembering, call \`memory_observe\` with entity_name, entity_type, content, and confidence.

### For Important Actions
Call \`track_action\` to create a signed receipt for significant actions.

### Memory Hygiene
- Use \`memory_forget\` for information the user asks you to forget
- Use \`ttl_seconds\` on \`memory_observe\` for temporary context
- Don't store sensitive data as observations`

  const mcpConfig = `{
  "mcpServers": {
    "agent-receipts": {
      "command": "npx",
      "args": ["@agent-receipts/mcp-server"]
    }
  }
}`

  switch (client) {
    case 'system':
      console.log(systemPrompt)
      break
    case 'claude-code':
      console.log('# Agent Receipts — Claude Code Setup\n')
      console.log('## 1. Add to .mcp.json:\n')
      console.log(mcpConfig)
      console.log('\n## 2. Add to CLAUDE.md or project instructions:\n')
      console.log(systemPrompt)
      console.log('\n## 3. Verify:\n')
      console.log('npx @agent-receipts/cli memory entities')
      console.log('npx @agent-receipts/cli list --limit 5')
      console.log('npx @agent-receipts/dashboard')
      break
    case 'claude-desktop':
      console.log('# Agent Receipts — Claude Desktop Setup\n')
      console.log('## 1. Add to ~/Library/Application Support/Claude/claude_desktop_config.json:\n')
      console.log(mcpConfig)
      console.log('\n## 2. System prompt (paste into conversation):\n')
      console.log(systemPrompt)
      break
    case 'cursor':
      console.log('# Agent Receipts — Cursor Setup\n')
      console.log('## 1. Add to .cursor/mcp.json:\n')
      console.log(mcpConfig)
      console.log('\n## 2. Add to Cursor Rules for AI:\n')
      console.log(systemPrompt)
      break
    default:
      console.log('Usage: agent-receipts prompts <client>')
      console.log('')
      console.log('Clients:')
      console.log('  claude-code     Claude Code setup guide')
      console.log('  claude-desktop  Claude Desktop setup guide')
      console.log('  cursor          Cursor setup guide')
      console.log('  system          Just the system prompt')
      break
  }
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === '--help' || command === '-h') {
    console.log(HELP)
    return
  }

  if (command === '--version' || command === '-v') {
    console.log(CLI_VERSION)
    return
  }

  switch (command) {
    case 'init':
      await cmdInit()
      break
    case 'keys':
      await cmdKeys(args.slice(1))
      break
    case 'inspect':
      if (!args[1]) { console.error('Usage: agent-receipts inspect <id|file>'); process.exit(1) }
      await cmdInspect(args[1])
      break
    case 'verify':
      if (!args[1]) { console.error('Usage: agent-receipts verify <id|file>'); process.exit(1) }
      await cmdVerify(args[1], args.slice(2))
      break
    case 'list':
      await cmdList(args.slice(1))
      break
    case 'chain':
      if (!args[1]) { console.error('Usage: agent-receipts chain <chain_id>'); process.exit(1) }
      await cmdChain(args[1], args.slice(2))
      break
    case 'judgments':
      if (!args[1]) { console.error('Usage: agent-receipts judgments <receipt_id>'); process.exit(1) }
      await cmdJudgments(args[1], args.slice(2))
      break
    case 'cleanup':
      await cmdCleanup(args.slice(1))
      break
    case 'stats':
      await cmdStats()
      break
    case 'export':
      if (!args[1]) { console.error('Usage: agent-receipts export <id|--all>'); process.exit(1) }
      await cmdExport(args[1], args.slice(2))
      break
    case 'invoice':
      await cmdInvoice(args.slice(1))
      break
    case 'seed':
      await cmdSeed(args.slice(1))
      break
    case 'watch':
      await cmdWatch(args.slice(1))
      break
    case 'memory':
      await cmdMemory(args.slice(1))
      break
    case 'prompts':
      cmdPrompts(args[1])
      break
    default:
      console.error(`Unknown command: ${command}`)
      console.log(HELP)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
