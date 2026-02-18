import { readFile } from 'node:fs/promises'
import {
  ReceiptStore,
  KeyManager,
  ConfigManager,
  ReceiptEngine,
} from '@agentreceipts/mcp-server'
import { verifyReceipt, getSignablePayload } from '@agentreceipts/crypto'

const HELP = `
agent-receipts — CLI for managing Agent Receipts

Usage:
  agent-receipts <command> [options]

Commands:
  init                        Create data directory and generate signing keys
  keys [--export]             Display or export the public key
  inspect <id|file>           Pretty-print a receipt
  verify <id|file> [--key <hex>]  Verify a receipt's signature
  list [options]              List receipts
  chain <chain_id>            Show all receipts in a chain
  stats                       Show aggregate receipt statistics
  export <id> | --all         Export receipt(s) as JSON to stdout

List options:
  --agent <id>                Filter by agent ID
  --status <status>           Filter by status (pending|completed|failed|timeout)
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
  return { engine: new ReceiptEngine(store, keyManager, configManager), keyManager }
}

async function cmdInit() {
  const { keyManager } = await getEngine()
  console.log('Initialized Agent Receipts data directory')
  console.log(`Public key: ${keyManager.getPublicKey()}`)
}

async function cmdKeys(args: string[]) {
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
  if (target.endsWith('.json')) {
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
}

async function cmdVerify(target: string, args: string[]) {
  let receipt
  if (target.endsWith('.json')) {
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
  } else {
    console.error(`FAILED: ${receipt.receipt_id} — signature invalid`)
    process.exit(1)
  }
}

async function cmdList(args: string[]) {
  const { engine } = await getEngine()
  const filter: Record<string, string> = {}
  const isJson = args.includes('--json')
  let limit = 50

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = args[i + 1]
    if (arg === '--agent' && next) { filter['agent_id'] = next; i++ }
    if (arg === '--status' && next) { filter['status'] = next; i++ }
    if (arg === '--limit' && next) { limit = parseInt(next, 10); i++ }
  }

  const result = await engine.list(filter, 1, limit)

  if (isJson) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(`Receipts (${result.pagination.total} total):`)
    for (const r of result.data) {
      const status = r.status.padEnd(9)
      console.log(`  ${r.receipt_id}  ${status}  ${r.action}  ${r.timestamp}`)
    }
  }
}

async function cmdChain(chainId: string) {
  const { engine } = await getEngine()
  const receipts = await engine.getChain(chainId)
  if (receipts.length === 0) {
    console.log(`No receipts found for chain: ${chainId}`)
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
  for (const r of receipts) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    byAction[r.action] = (byAction[r.action] ?? 0) + 1
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
}

async function cmdExport(target: string, args: string[]) {
  const { engine } = await getEngine()
  if (target === '--all' || args.includes('--all')) {
    const result = await engine.list(undefined, 1, 10000)
    console.log(JSON.stringify(result.data, null, 2))
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
      await cmdChain(args[1])
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
