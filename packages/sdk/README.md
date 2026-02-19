# @agentreceipts/sdk

TypeScript SDK for [Agent Receipts](https://github.com/webaesbyamin/agent-receipts). Track, verify, and manage signed receipts for AI agent actions. Everything runs locally.

## Install

```bash
npm install @agentreceipts/sdk
```

## Quick Start

```typescript
import { AgentReceipts } from '@agentreceipts/sdk'

const ar = new AgentReceipts()

const receipt = await ar.track({
  action: 'generate_report',
  input: { query: 'Q4 revenue' },
  output: { total: 142000 },
})

console.log(receipt.receipt_id)  // rcpt_8f3k2j4n...
console.log(receipt.signature)   // ed25519 hex signature
```

## API

### `new AgentReceipts(config?)`

```typescript
const ar = new AgentReceipts({
  dataDir: '~/.agent-receipts',  // optional, defaults to ~/.agent-receipts
})
```

### `ar.track(params)` — Track a completed action

```typescript
const receipt = await ar.track({
  action: 'analyze_data',
  input: { dataset: 'sales_2024' },
  output: { summary: 'Revenue up 12%' },
  agent_id: 'analyst-v2',
  chain_id: 'chain_abc',              // optional, auto-generated if omitted
  parent_receipt_id: 'rcpt_prev',     // optional, links to parent receipt
})
```

### `ar.emit(params)` — Alias for track

```typescript
const receipt = await ar.emit({ action: 'my_action', input: 'data' })
```

### `ar.start(params)` — Start a pending receipt

```typescript
const receipt = await ar.start({
  action: 'long_running_task',
  input: { job_id: '12345' },
})
```

### `ar.complete(receiptId, params)` — Complete a pending receipt

```typescript
const completed = await ar.complete(receipt.receipt_id, {
  output: { result: 'done' },
  status: 'completed',
})
```

### `ar.verify(receiptId)` — Verify a receipt signature

```typescript
const { verified, receipt } = await ar.verify('rcpt_8f3k2j4n')
```

### `ar.get(receiptId)` — Get a receipt by ID

```typescript
const receipt = await ar.get('rcpt_8f3k2j4n')
```

### `ar.list(filter?)` — List receipts

```typescript
const result = await ar.list({ agent_id: 'my-agent', status: 'completed' })
// result.data: ActionReceipt[]
// result.pagination: { page, pageSize, total }
```

### `ar.getPublicKey()` — Get the signing public key

```typescript
const publicKey = await ar.getPublicKey()
// 64-char hex string (Ed25519 public key)
```

## Examples

See the [examples](https://github.com/webaesbyamin/agent-receipts/tree/main/examples) directory for complete usage patterns including chained receipts and multi-step pipelines.

## License

MIT
