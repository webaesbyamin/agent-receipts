# @agent-receipts/sdk

TypeScript SDK for Agent Receipts — track actions, manage accountable memory, and verify receipts programmatically. Build AI features where every decision is cryptographically provable.

[Full Documentation](https://github.com/webaesbyamin/agent-receipts)

## Install

```bash
npm install @agent-receipts/sdk
```

## Quick Start

```typescript
import { AgentReceipts } from '@agent-receipts/sdk'

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

### `ar.track()` with Constraints

```typescript
const receipt = await ar.track({
  action: 'generate_summary',
  input: { document_id: 'doc-q4-2024' },
  output: { summary: 'Revenue grew 12% YoY...' },
  latency_ms: 1200,
  cost_usd: 0.005,
  constraints: [
    { type: 'max_latency_ms', value: 5000 },
    { type: 'max_cost_usd', value: 0.01 },
    { type: 'min_confidence', value: 0.8 },
  ],
})
// receipt.constraint_result.passed → true/false
```

### `ar.getJudgments(receiptId)` — Get judgments

```typescript
const judgments = await ar.getJudgments('rcpt_8f3k2j4n')
```

### `ar.context(params?)` — Get memory context summary

```typescript
const context = await ar.context({
  entityType: 'person',  // optional filter
  scope: 'user',         // optional: agent | user | team
  agentId: 'my-agent',   // optional filter
})
// Returns structured summary of entities, observations, and relationships
```

### `ar.observe(params)` — Store a memory observation

```typescript
const { entity, observation, receipt } = await ar.observe({
  entityName: 'Alice',
  entityType: 'person',
  content: 'Prefers TypeScript over JavaScript',
  agentId: 'my-agent',
  confidence: 'high',
  ttl_seconds: 86400,  // optional: auto-expire after 24 hours
})
```

### `ar.recall(params?)` — Search memories

```typescript
const { entities, observations } = await ar.recall({
  query: 'TypeScript',
  entityType: 'preference',
  agentId: 'my-agent',
})
```

### `ar.forget(params)` — Soft-delete a memory

```typescript
await ar.forget({ observationId: 'obs_abc', agentId: 'my-agent' })
await ar.forget({ entityId: 'ent_abc', agentId: 'my-agent' })
```

### `ar.cleanup()` — Delete expired receipts

```typescript
const { deleted, remaining } = await ar.cleanup()
```

## Examples

See the [examples](https://github.com/webaesbyamin/agent-receipts/tree/main/examples) directory for complete usage patterns including chained receipts and multi-step pipelines.

## License

MIT
