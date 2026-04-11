# Agent Receipts

**Logs tell you something happened. Receipts prove it.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Try_It_Now-blue)](https://agent-receipts-web.vercel.app/)
[![agent-receipts MCP server](https://glama.ai/mcp/servers/webaesbyamin/agent-receipts/badges/score.svg)](https://glama.ai/mcp/servers/webaesbyamin/agent-receipts)
[![npm version](https://img.shields.io/npm/v/@agent-receipts/mcp-server.svg)](https://www.npmjs.com/package/@agent-receipts/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

```json
{
  "mcpServers": {
    "agent-receipts": {
      "command": "npx",
      "args": ["@agent-receipts/mcp-server"]
    }
  }
}
```

## Real World Example

I built ModQuote — a multi-tenant SaaS for automotive shops. During development, I used Claude Code extensively for auditing and fixing the codebase.

The problem: when something went wrong, I had no way to prove what input Claude received, what it changed, or whether the output matched what was expected.

With Agent Receipts, every Claude Code session now generates signed receipts:

- **Input hash** proves exactly what code Claude saw
- **Output hash** proves exactly what it produced
- **Constraints** catch when latency spikes or costs exceed budget
- **Chains** show the full sequence of a multi-step audit session

When a fix didn't work as expected, I could pull the receipt, verify the signature, and see the exact input/output hashes — no guessing, no "Claude must have misunderstood."

That's the difference between logs and receipts. Logs tell you something happened. Receipts prove it.

## Quick Start: MCP Server

Add the Agent Receipts MCP server to your AI tool's config and every action gets a cryptographic receipt automatically.

> **Platform support:** macOS, Windows, and Linux — requires Node.js 18+

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-receipts": {
      "command": "npx",
      "args": ["@agent-receipts/mcp-server"]
    }
  }
}
```

### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "agent-receipts": {
      "command": "npx",
      "args": ["@agent-receipts/mcp-server"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "agent-receipts": {
      "command": "npx",
      "args": ["@agent-receipts/mcp-server"]
    }
  }
}
```

## Quick Start: SDK

```bash
npm install @agent-receipts/sdk
```

```typescript
import { AgentReceipts } from '@agent-receipts/sdk'

const ar = new AgentReceipts()

const receipt = await ar.track({
  action: 'generate_report',
  input: { query: 'Q4 revenue' },
  output: { total: 142000 },
})

console.log(receipt.receipt_id)  // rcpt_8f3k2j4n...
console.log(receipt.signature)   // ed25519 signature
```

## Quick Start: CLI

```bash
npx @agent-receipts/cli init          # Generate signing keys
npx @agent-receipts/cli keys          # Show public key
npx @agent-receipts/cli list          # List all receipts
npx @agent-receipts/cli verify <id>   # Verify a receipt signature
```

## How It Works

1. **Agent performs an action** — API call, code generation, data lookup
2. **Input/output are SHA-256 hashed** — raw data never leaves your machine
3. **Receipt is created** — action, hashes, timestamp, agent ID, metadata
4. **Receipt is Ed25519-signed** — with a locally generated private key
5. **Anyone can verify** — share your public key; recipients verify independently

## Memory Module (v0.3.0)

Memory in Agent Receipts is not a separate system — memory IS receipts. Every memory operation produces a signed, chained, auditable receipt.

### Memory via MCP Tools

```
memory_observe   — Store an observation about an entity
memory_recall    — Search and retrieve memories
memory_forget    — Soft-delete an observation or entity
memory_entities  — List known entities
memory_relate    — Create a relationship between entities
memory_provenance — Trace a memory back to its source
memory_audit     — Generate a memory audit report
```

### Memory via SDK

```typescript
const ar = new AgentReceipts()

// Observe — store a memory
const { entity, observation, receipt } = await ar.observe({
  entityName: 'Alice',
  entityType: 'person',
  content: 'Prefers TypeScript over JavaScript',
  agentId: 'my-agent',
  confidence: 'high',
})

// Recall — search memories
const { entities, observations } = await ar.recall({
  query: 'TypeScript',
  agentId: 'my-agent',
})

// Forget — auditable soft-delete
await ar.forget({
  observationId: observation.observation_id,
  agentId: 'my-agent',
  reason: 'No longer relevant',
})
```

### Memory via CLI

```bash
npx @agent-receipts/cli memory observe "Alice" "person" "Prefers TypeScript"
npx @agent-receipts/cli memory recall TypeScript
npx @agent-receipts/cli memory entities
npx @agent-receipts/cli memory forget <observation_id>
npx @agent-receipts/cli memory audit
npx @agent-receipts/cli memory provenance <observation_id>
npx @agent-receipts/cli memory export
npx @agent-receipts/cli memory import memories.json
```

### Key Concepts

- **Entity** — A typed object (person, project, preference, fact, etc.)
- **Observation** — A specific fact about an entity, linked to a receipt
- **Relationship** — A connection between two entities
- **Provenance** — Full chain from observation back to source receipt
- Every operation creates a signed `receipt_type: 'memory'` receipt
- Deletion is always soft — forgotten memories are retained for audit
- Full-text search via SQLite FTS5 — no external dependencies

## MCP Tools Reference

The MCP server exposes 21 tools that AI agents can call directly:

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `track_action` | Track an agent action with automatic hashing | `action`, `input`, `output`, `constraints` |
| `create_receipt` | Create a receipt with pre-computed hashes | `action`, `input_hash`, `output_hash`, `constraints` |
| `complete_receipt` | Complete a pending receipt with results | `receipt_id`, `output`, `status` |
| `verify_receipt` | Verify the cryptographic signature of a receipt | `receipt_id` |
| `get_receipt` | Retrieve a receipt by ID | `receipt_id` |
| `list_receipts` | List receipts with optional filtering | `agent_id`, `status`, `chain_id` |
| `get_chain` | Get all receipts in a chain ordered by timestamp | `chain_id` |
| `get_public_key` | Export the Ed25519 public key for verification | — |
| `judge_receipt` | Start AI Judge evaluation of a receipt | `receipt_id`, `rubric` |
| `complete_judgment` | Complete a pending judgment with results | `receipt_id`, `verdict`, `score`, `criteria` |
| `get_judgments` | Get all judgments for a receipt | `receipt_id` |
| `cleanup` | Delete expired receipts (TTL) | `dry_run` |
| `generate_invoice` | Generate an invoice from receipts in a date range | `from`, `to`, `format`, `agent_id` |
| `get_started` | Show a getting-started guide with usage examples | — |
| `memory_observe` | Store a memory observation about an entity | `entity_name`, `entity_type`, `content` |
| `memory_recall` | Search and retrieve stored memories | `query`, `entity_type`, `scope` |
| `memory_forget` | Soft-delete an observation or entity | `entity_id` or `observation_id` |
| `memory_entities` | List known entities with filtering | `entity_type`, `scope`, `query` |
| `memory_relate` | Create a relationship between two entities | `from_entity_id`, `to_entity_id`, `relationship_type` |
| `memory_provenance` | Get the provenance chain for an observation | `observation_id` |
| `memory_audit` | Generate a memory operations audit report | `agent_id`, `from`, `to` |

## SDK API Reference

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
// verified: true | false
```

### `ar.get(receiptId)` — Get a receipt by ID

```typescript
const receipt = await ar.get('rcpt_8f3k2j4n')
```

### `ar.list(filter?)` — List receipts

```typescript
const result = await ar.list({ agent_id: 'my-agent', status: 'completed' })
// result.data: ActionReceipt[]
// result.pagination: { page, limit, total, total_pages, has_next, has_prev }
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

### `ar.observe(params)` — Store a memory observation

```typescript
const { entity, observation, receipt } = await ar.observe({
  entityName: 'Alice',
  entityType: 'person',
  content: 'Prefers concise responses',
  agentId: 'my-agent',
  confidence: 'high',  // certain | high | medium | low
  scope: 'user',       // agent | user | team
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

### `ar.entities(filters?)` — List entities

```typescript
const { data, pagination } = await ar.entities({ entity_type: 'person' })
```

### `ar.relate(params)` — Create a relationship

```typescript
await ar.relate({
  fromEntityId: 'ent_alice', toEntityId: 'ent_project',
  relationshipType: 'builds', agentId: 'my-agent',
})
```

### `ar.provenance(observationId)` — Get provenance chain

```typescript
const chain = await ar.provenance('obs_abc')
```

### `ar.memoryAudit(params?)` — Memory audit report

```typescript
const report = await ar.memoryAudit()
```

### `ar.cleanup()` — Delete expired receipts

```typescript
const { deleted, remaining } = await ar.cleanup()
```

### `ar.generateInvoice(params)` — Generate invoice from receipts

```typescript
const invoice = await ar.generateInvoice({
  from: '2026-01-01',
  to: '2026-01-31',
  agent_id: 'my-agent',       // optional filter
  group_by: 'agent',          // optional: agent | action | day
})
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `init` | Create data directory and generate signing keys |
| `keys` | Display the public key |
| `keys --export` | Export public key as JSON |
| `keys --import <hex>` | Import a private key (64 hex chars) |
| `inspect <id\|file>` | Pretty-print a receipt |
| `verify <id\|file>` | Verify a receipt signature |
| `verify <id\|file> --key <hex>` | Verify with an external public key |
| `list` | List receipts (default: 50) |
| `list --agent <id> --status <s>` | Filter by agent or status |
| `list --json` | Output as JSON |
| `chain <chain_id>` | Show all receipts in a chain |
| `chain <chain_id> --tree` | Show chain as visual tree |
| `stats` | Show aggregate receipt statistics |
| `judgments <id>` | List judgments for a receipt |
| `cleanup` | Delete expired receipts |
| `cleanup --dry-run` | Preview what would be deleted |
| `export <id>` | Export a single receipt as JSON |
| `export --all` | Export all receipts as compact JSON |
| `export --all --pretty` | Export all receipts as formatted JSON |
| `invoice --from <date> --to <date>` | Generate invoice from receipts in date range |
| `invoice --format <fmt>` | Output as json, csv, md, or html |
| `seed --demo` | Seed demo data for testing |
| `seed --demo --count <n>` | Seed a custom number of demo receipts |
| `seed --demo --clean` | Delete all receipts before seeding |
| `watch` | Watch for new receipts in real-time |
| `watch --agent <id>` | Watch filtered by agent, action, or status |
| `memory observe <name> <type> <content>` | Store a memory observation |
| `memory recall [query]` | Search memories |
| `memory entities [--type <t>]` | List all entities |
| `memory forget <id>` | Soft-delete an observation or entity |
| `memory audit` | Print memory audit report |
| `memory provenance <obs_id>` | Print provenance chain |
| `memory export` | Export all memories as JSON |
| `memory import <file>` | Import memories from JSON |

## Receipt Format

```json
{
  "receipt_id": "rcpt_8f3k2j4n",
  "chain_id": "chain_x9f2k",
  "parent_receipt_id": null,
  "receipt_type": "action",
  "agent_id": "my-agent",
  "org_id": "my-org",
  "action": "generate_report",
  "status": "completed",
  "input_hash": "sha256:abc123...",
  "output_hash": "sha256:def456...",
  "output_summary": "Generated Q4 report",
  "model": "claude-sonnet-4-20250514",
  "timestamp": "2026-02-07T14:32:01.442Z",
  "completed_at": "2026-02-07T14:32:02.100Z",
  "latency_ms": 658,
  "cost_usd": 0.003,
  "signature": "ed25519:<hex>"
}
```

Input and output are hashed client-side with SHA-256. Raw data never leaves your environment. Only hashes are stored in the receipt.

## Verification

Share your public key with anyone who needs to verify your receipts:

```bash
# Export your public key
npx @agent-receipts/cli keys --export

# Verify a receipt with an external public key
npx @agent-receipts/cli verify receipt.json --key <public-key-hex>
```

Verification re-computes the Ed25519 signature over the receipt's deterministic fields and confirms it matches the stored signature. No network requests — fully offline.

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `AGENT_RECEIPTS_DATA_DIR` | Data directory path | `~/.agent-receipts` |
| `AGENT_RECEIPTS_AGENT_ID` | Default agent ID | `local-agent` |
| `AGENT_RECEIPTS_ORG_ID` | Organization ID | `local-org` |
| `AGENT_RECEIPTS_ENVIRONMENT` | Environment label (`development`, `production`, `staging`, `test`) | `production` |
| `RECEIPT_SIGNING_PRIVATE_KEY` | Ed25519 private key (hex) | Auto-generated |

## Storage

All data is stored locally in the data directory:

```
~/.agent-receipts/
├── keys/
│   ├── private.key          # Ed25519 private key (mode 0600)
│   └── public.key           # Ed25519 public key
├── receipts/
│   └── *.json               # Legacy JSON files (auto-migrated)
├── receipts.db              # SQLite database (primary storage)
└── config.json              # Agent and org configuration
```

As of v0.2.7, receipts are stored in SQLite with indexed queries for fast filtering and pagination. Existing JSON receipt files are automatically migrated on first startup. As of v0.3.0, memory entities, observations, and relationships are stored in the same database with full-text search via FTS5.

## Architecture

```
┌─────────────────────────────────────────────┐
│                  CLI                         │
│           @agent-receipts/cli                 │
├─────────────────────────────────────────────┤
│           SDK            │   MCP Server      │
│   @agent-receipts/sdk     │ @agent-receipts/   │
│                          │   mcp-server      │
├──────────────────────────┴──────────────────┤
│              Crypto + Schema                 │
│   @agent-receipts/crypto  @agent-receipts/     │
│                            schema            │
└─────────────────────────────────────────────┘
```

- **schema** — Zod schemas, TypeScript types, JSON Schema for the Action Receipt Protocol
- **crypto** — Ed25519 key generation, signing, verification, canonical serialization
- **mcp-server** — MCP protocol server with receipt engine, storage, and key management
- **sdk** — High-level Node.js SDK wrapping the engine
- **cli** — Command-line tool for inspecting, verifying, and managing receipts
- **dashboard** — Mission Control web UI for visualizing and managing receipts

## Dashboard (Mission Control)

Visualize every receipt, chain, agent, constraint, and judgment in your system.

```bash
npx @agent-receipts/dashboard
```

Opens Mission Control at http://localhost:3274 — visualize, verify, and manage all receipts.

Features: real-time receipt feed, chain visualization, constraint health monitoring, judgment scores, signature verification, invoice generation, memory browser, dark mode, global search.

16 pages: Overview, Receipts, Receipt Detail, Chains, Chain Detail, Agents, Agent Detail, Constraints, Judgments, Invoices, Memory, Entity Detail, Memory Audit, Verify, Settings, How It Works.

## Examples

| Example | Description |
|---------|-------------|
| [`examples/basic`](./examples/basic) | Simple action tracking with verification |
| [`examples/chained`](./examples/chained) | Multi-step pipeline with parent/child receipt linking |
| [`examples/pipeline`](./examples/pipeline) | Document analysis pipeline with chained receipts |
| [`examples/constraints`](./examples/constraints) | Constraint verification with pass/fail rules |
| [`examples/judge`](./examples/judge) | AI Judge evaluation with rubrics |
| [`examples/ttl`](./examples/ttl) | Receipt TTL and cleanup |

## Packages

| Package | Description |
|---------|-------------|
| `@agent-receipts/schema` | Zod schemas and TypeScript types for the Action Receipt Protocol |
| `@agent-receipts/crypto` | Ed25519 signing, verification, and key management |
| `@agent-receipts/mcp-server` | MCP protocol server with receipt engine and storage |
| `@agent-receipts/sdk` | High-level Node.js SDK for tracking and verifying receipts |
| `@agent-receipts/cli` | Command-line tool for managing receipts |
| `@agent-receipts/dashboard` | Mission Control web UI — `npx @agent-receipts/dashboard` |

## Roadmap

- [x] Local-first receipt storage (SQLite with indexed queries)
- [x] Ed25519 signing and verification
- [x] MCP server with 21 tools
- [x] Node.js SDK
- [x] CLI with full command set
- [x] Constraint verification (6 built-in types)
- [x] AI Judge with rubric-based evaluation
- [x] Output schema validation (JSON Schema)
- [x] Receipt TTL and cleanup
- [x] Invoice generation (JSON, CSV, Markdown, HTML)
- [x] Mission Control dashboard (16 pages, dark mode, search)
- [x] Dashboard npm package — `npx @agent-receipts/dashboard`
- [x] Live demo at [agent-receipts-web.vercel.app](https://agent-receipts-web.vercel.app/)
- [x] Memory Module — entity-observation pattern with cryptographic provenance
- [ ] Receipt anchoring to blockchain/timestamping services
- [ ] Multi-agent receipt sharing protocol
- [ ] Receipt compression and archival
- [ ] Hosted tier with cloud database

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm dev
```

## License

MIT — see [LICENSE](./LICENSE)
