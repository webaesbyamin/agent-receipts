# Agent Receipts

**Logs tell you something happened. Receipts prove it.**

The trust layer for AI agents. Every action signed, every memory provable, every decision auditable — with Ed25519 cryptography, not just logging.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Try_It_Now-blue)](https://agent-receipts-web.vercel.app/)
[![Interactive Walkthrough](https://img.shields.io/badge/Walkthrough-60_Seconds-green)](https://agent-receipts-web.vercel.app/walkthrough)
[![npm version](https://img.shields.io/npm/v/@agent-receipts/mcp-server.svg)](https://www.npmjs.com/package/@agent-receipts/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[Try the Interactive Demo](https://agent-receipts-web.vercel.app/walkthrough) · [Get Started](#get-started) · [Documentation](#documentation)

---

## The Problem

You deploy an AI agent. It generates a customer quote, modifies a database, sends an email, remembers a user preference. Something goes wrong.

- What input did the agent actually receive?
- What did it change, and when?
- Did the output match your constraints?
- Which agent decided to remember that fact — and can you prove it?

Logs can answer some of this. But logs are mutable, siloed, and easily lost. You can't hand a log to a customer, an auditor, or another agent and say: **"Here's cryptographic proof of exactly what happened."**

Agent Receipts can.

## How I Got Here

I was building [ModQuote](https://modquote.io) — a multi-tenant SaaS where AI agents generate quotes for automotive protection shops. PPF pricing, ceramic coatings, window tint — configurations that affect real money.

When Claude generated a $2,400 quote, I needed to know: what vehicle data did it receive? What pricing rules did it apply? Did the output match the shop's constraints? If a customer disputes the price, can I prove what happened?

I searched for a tool that could answer these questions. Observability platforms track latency and cost. Memory tools store context. But nothing provided **verifiable, tamper-proof proof** that a specific agent took a specific action with specific inputs and outputs at a specific time.

So I built Agent Receipts. Every quote generation is now a signed receipt. Every memory observation has a provenance chain. Every agent action is cryptographically accountable — and I can prove it to anyone, offline, without a server.

## What It Does

Agent Receipts provides three capabilities:

### 1. Action Receipts
Every agent action produces a signed receipt — a JSON document with Ed25519 signature, input/output hashes, timestamps, constraints, and verification URL. Receipts are immutable and independently verifiable.

```bash
# Connect to Claude Code / Claude Desktop / Cursor
npx @agent-receipts/mcp-server
```

The agent gets 24 tools. `track_action` creates a signed receipt for any operation. `verify_receipt` lets anyone check the signature. No API key, no account, no server — everything runs locally.

### 2. Accountable Memory
AI agents remember things. Agent Receipts makes those memories **provable**.

Every observation is an entity in a structured knowledge graph (person, project, tool, preference) with signed receipts proving when it was created, by which agent, from what conversation. Memories can be recalled, forgotten (auditably), exported as portable bundles, and verified by third parties.

```
memory_observe → "User prefers TypeScript" → signed receipt → provenance chain
memory_recall  → search memories → results (no receipt noise by default)
memory_context → full context dump → session initialization
memory_forget  → soft delete → auditable (the forget itself is receipted)
```

No other memory system can answer: **"Prove when this agent learned that fact."**

### 3. Quality & Compliance
- **Constraints** — enforce rules on every receipt (max cost, min confidence, required fields, output schema)
- **AI Judge** — evaluate agent output against rubrics, with judgment receipts chained to the original action
- **Invoicing** — generate cryptographically verifiable invoices from receipt chains
- **Memory Bundles** — export portable, verifiable memory packages for sharing across agents or organizations

## Who It's For

**Developers building with AI agents** — Track what Claude Code does across sessions. Audit code generation. Prove deployments happened.

**SaaS products with AI features** — Prove to customers what your agent did with their data. ModQuote proves quote accuracy; your product proves whatever your agents do.

**Teams running multi-agent workflows** — When Agent A passes context to Agent B, receipts prove the handoff. Memory bundles let agents share verified knowledge.

**Regulated industries** — Healthcare, finance, legal — anywhere AI decisions need an audit trail. Receipts are offline-verifiable with no vendor lock-in.

## How It Compares

| | Agent Receipts | Mem0 | Langfuse | Zep |
|---|---|---|---|---|
| **Core** | Cryptographic proof | Memory persistence | Observability | Memory + RAG |
| **Signing** | Ed25519 on every action | None | None | None |
| **Memory** | Signed, provable, portable | Yes (hosted) | No | Yes (hosted) |
| **Verification** | Offline, by anyone | No | No | No |
| **Infrastructure** | Local-first, zero config | Cloud API | Cloud or self-host | Cloud API |
| **Cost** | Free (local) | Paid | Free tier + paid | Paid |
| **Audit trail** | Tamper-proof receipt chain | Mutable | Mutable logs | Mutable |

**Agent Receipts is not an observability tool.** Observability tells you what happened inside your system. Receipts prove what happened to anyone outside it.

## Get Started

### 1. Connect the MCP Server

**Claude Code:**
```bash
claude mcp add agent-receipts -- npx @agent-receipts/mcp-server
```

**Claude Desktop** (`claude_desktop_config.json`) / **Cursor** (`.cursor/mcp.json`):
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

> **Platform support:** macOS, Windows, and Linux — requires Node.js 18+

### 2. Add the System Prompt

Copy the recommended system prompt for your client:
```bash
npx @agent-receipts/cli prompts claude-code
```

This tells the agent when to track actions, observe memories, and recall context — so it works automatically.

### 3. Open the Dashboard

```bash
npx @agent-receipts/dashboard
```

See your receipts, memory graph, constraint health, and agent activity at `localhost:3274`.

### 4. Try the Interactive Demo

Don't want to install yet? [Experience Agent Receipts in your browser →](https://agent-receipts-web.vercel.app/walkthrough)

## The Stack

- **6 npm packages** — schema, crypto, mcp-server, sdk, cli, dashboard
- **24 MCP tools** — action tracking, memory, verification, constraints, judgments, invoicing, bundles
- **21 SDK methods** — full TypeScript API
- **14 CLI commands + 9 memory subcommands** — terminal-first workflow
- **18 dashboard pages** — Next.js 15, dark mode, real-time refresh
- **492 tests** — zero TypeScript `any`, zero ESLint warnings
- **Ed25519 + SHA-256** — audited cryptography via `@noble/ed25519`
- **SQLite + FTS5** — local-first storage with full-text search
- **Zero dependencies on external services** — no API keys, no accounts, no cloud required

## Documentation

| Resource | Description |
|----------|-------------|
| [Interactive Demo](https://agent-receipts-web.vercel.app/walkthrough) | Try it in your browser — 60 seconds |
| [How It Works](https://agent-receipts-web.vercel.app/how-it-works) | Architecture, receipt anatomy, memory model |
| [Dashboard Demo](https://agent-receipts-web.vercel.app) | Live demo with sample data |
| [CLI Reference](packages/cli/README.md) | All commands and flags |
| [SDK Reference](packages/sdk/README.md) | TypeScript API documentation |
| [MCP Tools Reference](packages/mcp-server/README.md) | All 24 tools with parameters |

## SDK Quick Start

```typescript
import { AgentReceipts } from '@agent-receipts/sdk'

const ar = new AgentReceipts()

// Track an action with a signed receipt
const receipt = await ar.track({
  action: 'generate_quote',
  input: { vehicle: 'Tesla Model 3', service: 'PPF full front' },
  output: { price: 2400, coverage: 'full_front' },
})

// Store a provable memory
const { entity, observation } = await ar.observe({
  entityName: 'Customer',
  entityType: 'person',
  content: 'Prefers full-front PPF coverage',
  agentId: 'quote-agent',
  confidence: 'high',
})

// Verify any receipt
const { verified } = await ar.verify(receipt.receipt_id)
```

<details>
<summary><strong>Full SDK API Reference (21 methods)</strong></summary>

### Action Tracking
- `ar.track(params)` — Track a completed action with automatic hashing
- `ar.start(params)` — Create a pending receipt
- `ar.complete(receiptId, params)` — Complete a pending receipt
- `ar.verify(receiptId)` — Verify a receipt's Ed25519 signature
- `ar.get(receiptId)` — Get a receipt by ID
- `ar.list(filter?)` — List receipts with filtering and pagination
- `ar.getPublicKey()` — Get the signing public key
- `ar.getJudgments(receiptId)` — Get judgments for a receipt
- `ar.cleanup()` — Delete expired receipts
- `ar.generateInvoice(options)` — Generate invoice from receipts

### Memory
- `ar.context(params?)` — Get full memory context dump for session init
- `ar.observe(params)` — Store a memory observation (always receipted)
- `ar.recall(params?)` — Search memories (quiet by default, `audited: true` for receipt)
- `ar.forget(params)` — Soft-delete observation or entity (always receipted)
- `ar.entities(filters?)` — List entities
- `ar.relate(params)` — Create entity relationship
- `ar.provenance(observationId)` — Get provenance chain
- `ar.memoryAudit(params?)` — Memory audit report

### Bundles
- `ar.exportBundle(params?)` — Export portable, verifiable memory bundle
- `ar.importBundle(bundle, params?)` — Import and verify a memory bundle

### Aliases
- `ar.emit(params)` — Alias for `track()`

</details>

<details>
<summary><strong>Full MCP Tools Reference (24 tools)</strong></summary>

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `track_action` | Track an agent action with automatic hashing | `action`, `input`, `output`, `constraints` |
| `create_receipt` | Create a receipt with pre-computed hashes | `action`, `input_hash`, `output_hash` |
| `complete_receipt` | Complete a pending receipt with results | `receipt_id`, `output`, `status` |
| `verify_receipt` | Verify the cryptographic signature | `receipt_id` |
| `get_receipt` | Retrieve a receipt by ID | `receipt_id` |
| `list_receipts` | List receipts with filtering | `agent_id`, `status`, `chain_id` |
| `get_chain` | Get all receipts in a chain | `chain_id` |
| `get_public_key` | Export the Ed25519 public key | — |
| `judge_receipt` | Start AI Judge evaluation | `receipt_id`, `rubric` |
| `complete_judgment` | Complete a pending judgment | `receipt_id`, `verdict`, `score` |
| `get_judgments` | Get all judgments for a receipt | `receipt_id` |
| `cleanup` | Delete expired receipts | `dry_run`, `cleanup_memory` |
| `generate_invoice` | Generate invoice from receipts | `from`, `to`, `format` |
| `get_started` | Getting-started guide | — |
| `memory_context` | Full context dump for session init | `scope`, `max_entities` |
| `memory_observe` | Store a memory observation | `entity_name`, `entity_type`, `content` |
| `memory_recall` | Search stored memories | `query`, `entity_type`, `scope` |
| `memory_forget` | Soft-delete observation or entity | `entity_id` or `observation_id` |
| `memory_entities` | List known entities | `entity_type`, `scope`, `query` |
| `memory_relate` | Create entity relationship | `from_entity_id`, `to_entity_id`, `type` |
| `memory_provenance` | Provenance chain for observation | `observation_id` |
| `memory_audit` | Memory operations audit report | `agent_id`, `from`, `to` |
| `memory_export_bundle` | Export portable memory bundle | `entity_ids`, `include_receipts` |
| `memory_import_bundle` | Import and verify memory bundle | `bundle`, `skip_existing` |

</details>

<details>
<summary><strong>Full CLI Reference</strong></summary>

| Command | Description |
|---------|-------------|
| `init` | Create data directory and generate signing keys |
| `keys [--export] [--import]` | Display, export, or import signing keys |
| `inspect <id\|file>` | Pretty-print a receipt |
| `verify <id\|file> [--key]` | Verify a receipt signature |
| `list [--agent] [--status] [--json]` | List receipts with filters |
| `chain <chain_id> [--tree]` | Show receipt chain |
| `judgments <id> [--json]` | List judgments for a receipt |
| `cleanup [--dry-run]` | Delete expired receipts |
| `stats` | Aggregate receipt statistics |
| `export <id\|--all> [--pretty]` | Export receipts as JSON |
| `invoice --from --to [--format]` | Generate invoice |
| `seed [--demo] [--count] [--clean]` | Seed demo data |
| `watch [--agent] [--action]` | Watch for new receipts |
| `prompts <client>` | Setup guide (claude-code, cursor, system) |
| `memory context` | Memory context summary |
| `memory observe <name> <type> <content>` | Store observation |
| `memory recall [query]` | Search memories |
| `memory entities [--type]` | List entities |
| `memory forget <id>` | Forget observation or entity |
| `memory audit` | Memory audit report |
| `memory provenance <obs_id>` | Provenance chain |
| `memory export` | Export memories as JSON |
| `memory import <file>` | Import memories |

</details>

<details>
<summary><strong>Configuration</strong></summary>

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `AGENT_RECEIPTS_DATA_DIR` | Data directory path | `~/.agent-receipts` |
| `AGENT_RECEIPTS_AGENT_ID` | Default agent ID | `local-agent` |
| `AGENT_RECEIPTS_ORG_ID` | Organization ID | `local-org` |
| `AGENT_RECEIPTS_ENVIRONMENT` | Environment label | `production` |
| `RECEIPT_SIGNING_PRIVATE_KEY` | Ed25519 private key (hex) | Auto-generated |

**Storage:**
```
~/.agent-receipts/
├── keys/
│   ├── private.key    # Ed25519 private key (mode 0600)
│   └── public.key     # Ed25519 public key
├── receipts.db        # SQLite database (receipts + memory)
└── config.json        # Agent and org configuration
```

</details>

## Packages

| Package | Description |
|---------|-------------|
| [`@agent-receipts/schema`](packages/schema) | Zod schemas and TypeScript types |
| [`@agent-receipts/crypto`](packages/crypto) | Ed25519 signing, verification, key management |
| [`@agent-receipts/mcp-server`](packages/mcp-server) | MCP server with 24 tools |
| [`@agent-receipts/sdk`](packages/sdk) | TypeScript SDK (21 methods) |
| [`@agent-receipts/cli`](packages/cli) | Command-line interface |
| [`@agent-receipts/dashboard`](packages/dashboard) | Mission Control web UI |

## Roadmap

- [ ] Hosted cloud tier — team dashboards, cross-org verification, multi-agent memory sync
- [ ] Embedding-powered semantic recall — smarter memory search
- [ ] Cross-org trust bridges — two organizations verifying each other's receipts
- [ ] Official integrations — LangChain, CrewAI, AutoGen adapters

## License

MIT — use it however you want.

---

Built by [Amin Suleiman](https://webaes.com) · [GitHub](https://github.com/webaesbyamin/agent-receipts) · [npm](https://www.npmjs.com/org/agent-receipts)
