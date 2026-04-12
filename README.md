# Agent Receipts

**Your AI agent remembers everything — and you can prove it.**

Persistent memory for AI agents, backed by cryptographic receipts. Every fact your agent learns is signed, traceable, and independently verifiable. No cloud required.

[![Live Demo](https://img.shields.io/badge/Live_Demo-Try_It_Now-blue)](https://agent-receipts-web.vercel.app/)
[![Interactive Walkthrough](https://img.shields.io/badge/Walkthrough-60_Seconds-green)](https://agent-receipts-web.vercel.app/walkthrough)
[![npm version](https://img.shields.io/npm/v/@agent-receipts/mcp-server.svg)](https://www.npmjs.com/package/@agent-receipts/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[Try the Interactive Demo](https://agent-receipts-web.vercel.app/walkthrough) · [Install in 30 Seconds](#get-started) · [How It's Different](#how-its-different)

---

## The Problem

You're building with AI agents. Claude Code refactors your auth module and says "done, all tests pass." Your agent generates a customer quote and says it applied the right pricing. Your assistant remembers your preferences from last week — but you can't see why it thinks that, or whether it's right.

Three things are broken:

1. **Agents forget everything between sessions.** Every conversation starts from zero. Context is lost. You re-explain the same things.

2. **When agents do remember, you can't see inside.** Platform memory is a black box. You can't see what it stored, when, or why. You can't correct it, export it, or verify it.

3. **There's no proof of what agents actually did.** Logs are mutable. Agents write their own logs. "I updated 3 files and all tests pass" — did it? You're trusting the agent's word about its own work.

## What Agent Receipts Does

### Memory that actually works

Your agent gets structured, persistent memory across sessions — people, projects, tools, preferences, facts. Not a flat key-value store. An entity-observation graph where every fact links to the conversation that created it.

```bash
# Your agent learns something
memory_observe → "User prefers TypeScript, uses Neovim, building a SaaS called ModQuote"

# Next session, it already knows
memory_context → loads everything: entities, observations, relationships, preferences

# You can search it
memory_recall → "what tech stack does the user prefer?" → structured results

# You can forget (and the forget itself is tracked)
memory_forget → soft delete with audit trail
```

The agent handles this automatically when you add the [system prompt](#system-prompt). You don't manage memory manually.

### Proof that's actually proof

Every memory observation and every agent action produces a **receipt** — a signed JSON document with:

- **Ed25519 signature** — tamper-proof, independently verifiable
- **Input/output hashes** — proves exactly what went in and came out (raw data never stored)
- **Timestamps** — when it happened, when it completed
- **Agent ID** — which agent did it
- **Provenance chain** — trace any memory back to the conversation that created it

This isn't logging. Logs are mutable text files the agent writes about itself. Receipts are cryptographic proof that a third party can verify without trusting you, your server, or the agent.

### Everything runs locally

```bash
npx @agent-receipts/mcp-server
```

That's it. No API key. No account. No cloud. No monthly fee. No data leaving your machine. SQLite database in `~/.agent-receipts/`. Works offline.

## Why This Exists

I was building [ModQuote](https://modquote.io) — a multi-tenant SaaS where AI agents generate quotes for automotive protection shops. Real money, real customers, real liability.

When Claude generated a $2,400 PPF quote, I needed answers: What vehicle data did it receive? What pricing rules did it apply? If a customer disputes the price, can I prove what happened — not with a log entry the agent wrote about itself, but with cryptographic proof?

I looked at the existing tools:

- **Mem0** — great memory, but no proof. It remembers things, but can't prove when or why it learned them. Memories are mutable.
- **Langfuse** — great observability, but it's tracing, not proof. Logs are internal to your system, not verifiable by third parties.
- **Zep** — temporal knowledge graph, but hosted and opaque.

None of them could answer: **"Prove to someone outside your system that this specific agent took this specific action with this specific input at this specific time."**

So I built Agent Receipts. Now every quote generation is a signed receipt. Every memory has a provenance chain. And when someone asks "how did the agent come up with that number?" — I hand them a receipt they can verify themselves.

## How It's Different

| | Agent Receipts | Mem0 | Langfuse | Zep |
|---|---|---|---|---|
| **Memory** | Signed entity-observation graph | Smart extraction + consolidation | No memory | Temporal knowledge graph |
| **Proof** | Ed25519 signed receipts | None | Mutable traces | None |
| **Verification** | Offline, by anyone, no server | No | No | No |
| **Infrastructure** | `npx` and done. Zero config. | Requires LLM for extraction | Cloud or self-host | Cloud API |
| **Cost** | Free forever (local) | Free tier, then paid | Free tier, then paid | Paid |
| **Export** | Portable bundles with crypto verification | Export available | API export | No |
| **Audit trail** | Immutable receipt chain | Mutable | Mutable logs | Mutable |

**Agent Receipts isn't a better version of these tools. It's a different thing.**

Mem0 answers: *"What does my agent remember?"*
Langfuse answers: *"What happened in my LLM pipeline?"*
Agent Receipts answers: *"Can you prove it?"*

## Get Started

### 1. Add the MCP Server

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

### 2. Add the System Prompt {#system-prompt}

This tells your agent when to observe memories, recall context, and track actions — so it works automatically:

```bash
npx @agent-receipts/cli prompts claude-code
```

Copy the output into your project instructions or system prompt.

### 3. Start Using It

Your agent will now:
- Call `memory_context` at the start of sessions to load what it knows about you
- Call `memory_observe` when it learns something worth remembering
- Call `track_action` when it performs significant actions
- Sign everything with Ed25519

### 4. See What's Happening

```bash
npx @agent-receipts/dashboard    # Web UI at localhost:3274
npx @agent-receipts/cli stats    # Terminal overview
npx @agent-receipts/cli memory entities  # See what your agent remembers
```

### 5. Try Before Installing

[Run the interactive demo →](https://agent-receipts-web.vercel.app/walkthrough) — experience memory, verification, and bundle export in 60 seconds. No install required.

## What's Inside

- **24 MCP tools** — memory, actions, verification, constraints, judgments, invoicing, bundles
- **21 SDK methods** — full TypeScript API
- **14 CLI commands + 9 memory subcommands** — terminal-first
- **18 dashboard pages** — receipts, memory graph, chains, agents, constraints, judgments, invoices
- **492 tests** — zero TypeScript `any`, zero ESLint warnings
- **Ed25519 + SHA-256** — via `@noble/ed25519` (audited, pure JS)
- **SQLite + FTS5** — local-first with full-text memory search

## Portable Memory Bundles

Export your agent's entire memory as a single verifiable file:

```bash
npx @agent-receipts/cli memory export > my-project.bundle.json
```

The bundle includes every entity, observation, relationship, the receipts that created them, and the public key needed to verify everything. Hand it to another agent, another team, or another Agent Receipts instance — they can verify every fact without trusting you.

## Links

| | |
|---|---|
| [Interactive Demo](https://agent-receipts-web.vercel.app/walkthrough) | Try it in your browser — 60 seconds |
| [Live Dashboard](https://agent-receipts-web.vercel.app) | See the full dashboard with sample data |
| [How It Works](https://agent-receipts-web.vercel.app/how-it-works) | Receipt anatomy, memory model, ModQuote story |
| [npm](https://www.npmjs.com/org/agent-receipts) | All 6 packages |

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

- [ ] **Cloud tier** — team dashboards, multi-agent memory sync, cross-org verification
- [ ] **Semantic recall** — embedding-powered memory search
- [ ] **Framework adapters** — LangChain, CrewAI, AutoGen integrations
- [ ] **Cross-org trust bridges** — two organizations verifying each other's agent receipts

## License

MIT

---

Built by [Amin Suleiman](https://webaes.com) — building [ModQuote](https://modquote.io) and [Agent Receipts](https://github.com/webaesbyamin/agent-receipts).
