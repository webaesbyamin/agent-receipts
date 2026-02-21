import { readFile, writeFile, mkdir, chmod, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import {
  ReceiptStore,
  KeyManager,
  ConfigManager,
  ReceiptEngine,
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
  return { engine: new ReceiptEngine(store, keyManager, configManager), keyManager, dataDir: dir }
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

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === '--help' || command === '-h') {
    console.log(HELP)
    return
  }

  if (command === '--version' || command === '-v') {
    console.log('0.1.0')
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
