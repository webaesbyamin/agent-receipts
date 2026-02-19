import { readFile, writeFile, mkdir, chmod, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import {
  ReceiptStore,
  KeyManager,
  ConfigManager,
  ReceiptEngine,
} from '@agent-receipts/mcp-server'
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
  stats                             Show aggregate receipt statistics
  export <id> | --all [--pretty]    Export receipt(s) as JSON to stdout

List options:
  --agent <id>                Filter by agent ID
  --status <status>           Filter by status (pending|completed|failed|timeout)
  --failed                    Show only receipts with failed constraints
  --passed                    Show only receipts with passed constraints
  --limit <n>                 Limit results (default: 50)
  --json                      Output as JSON

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
    case 'stats':
      await cmdStats()
      break
    case 'export':
      if (!args[1]) { console.error('Usage: agent-receipts export <id|--all>'); process.exit(1) }
      await cmdExport(args[1], args.slice(2))
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
