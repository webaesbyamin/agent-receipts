# Agent Receipts

**Your agent says it's done. Prove it.**

Agent Receipts gives the work your AI agent does a signed receipt: what went in, what came out, which model ran, how long it took and what it cost. Each receipt is signed with Ed25519 and linked to the one before it, so anyone can check it offline with your public key, without trusting you, your server or the agent. Change one byte and it no longer verifies.

```bash
claude mcp add agent-receipts -- npx @agent-receipts/mcp-server
```

[receipts.webaes.com](https://receipts.webaes.com) (what it is, install, and a page that signs itself) · [demo.receipts.webaes.com](https://demo.receipts.webaes.com) (the dashboard with sample data) · [verify.webaes.com](https://verify.webaes.com) (a real issuer's verify page) · by [Webaes](https://webaes.com)

[![Live Demo](https://img.shields.io/badge/Live_Demo-Try_It_Now-blue)](https://demo.receipts.webaes.com/)
[![Interactive Walkthrough](https://img.shields.io/badge/Walkthrough-60_Seconds-green)](https://demo.receipts.webaes.com/walkthrough)
[![npm version](https://img.shields.io/npm/v/@agent-receipts/mcp-server.svg)](https://www.npmjs.com/package/@agent-receipts/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

[Automatic receipts](#automatic-receipts) · [Get started](#get-started) · [Magic Folder](#magic-folder-receipts-for-people-who-dont-code) · [Memory](#memory) · [How it's different](#how-its-different)

---

## Automatic receipts

Get a signed receipt for everything your agent does, without changing how you work.

**Claude Code: one command.** Every file edit, file write, notebook edit and shell command gets its own signed receipt, chained per session, and the session ends with a summary (actions, files touched, duration):

```bash
npx @agent-receipts/cli hooks install            # or --scope project / --scope local
```

It shows the change to Claude Code's `settings.json` and asks first; `hooks uninstall` takes it out again. Or install it as a Claude Code plugin:

```bash
claude plugin marketplace add webaesbyamin/agent-receipts
claude plugin install agent-receipts@agent-receipts
```

**Any MCP server: the proxy.** Put it in front of a stdio MCP server and every tool call through it is signed (`mcp.<server>.<tool>`), while every message passes through unchanged:

```bash
claude mcp add fs-receipted -- npx -y @agent-receipts/cli proxy --name fs -- npx -y @modelcontextprotocol/server-filesystem ~/Documents
```

Receipts hold hashes only (inputs, outputs, and each changed file), never commands, file contents or results. See them in the dashboard's Sessions view (`npx @agent-receipts/dashboard`) or check one with `agent-receipts verify-chain <session id>`. Setup for Claude Desktop and Cursor: [CLI README](packages/cli#receipts-for-any-mcp-server-the-proxy).

**What these receipts do and don't prove:**

- **They prove what Claude Code (or the MCP client) reported, signed outside the agent.** The hook and the proxy run as separate processes, and each receipt is signed the moment the tool finishes, so the agent can't edit a receipt afterwards without breaking it. They don't prove the work was right, only what was done and that the record hasn't changed.
- **`claude -p` can stop the last one.** In a scripted run, Claude Code stops background hooks still running when the run ends, so a tool call in the last moment of a run can go unrecorded.
- **The computer's owner controls the keys.** Receipts are signed with keys in `~/.agent-receipts` on your machine. They show the record wasn't changed after signing; someone who controls that machine could sign a false one. To show others, publish your public key so they know which key to trust.
- **stdio MCP servers only for now.** Remote (HTTP) MCP servers aren't covered yet.


## Proof

Every memory observation and every action your agent tracks produces a **receipt** — a signed JSON document with:

- **Ed25519 signature** over every field (receipt format v2) — tamper-proof, independently verifiable
- **Input/output hashes** — proves exactly what went in and came out (raw data never stored)
- **Timestamps** — when it happened, when it completed
- **Agent ID** — which agent did it
- **Link to the previous receipt** — the hash of the one before it, so a missing receipt shows
- **Provenance chain** — trace any memory back to the conversation that created it

This isn't logging. Logs are mutable text files the agent writes about itself. Receipts are cryptographic proof that a third party can verify without trusting you, your server, or the agent.

### Everything runs locally

```bash
npx @agent-receipts/mcp-server
```

That's it. No API key. No account. No cloud. No monthly fee. No data leaving your machine. SQLite database in `~/.agent-receipts/`. Works offline. Needs Node.js 22.16 or later.

## Get Started

Needs Node.js 22.16 or later.

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

### 2. Add the System Prompt

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

[Run the interactive demo →](https://demo.receipts.webaes.com/walkthrough) — experience memory, verification, and bundle export in 60 seconds. No install required.

## Magic Folder: receipts for people who don't code

Drop a file into a folder named after a job ("Write product descriptions", "Fix typos"). An agent does the work, and the result comes back in `Done/` with your untouched original and a one-page `receipt.html` that anyone can check, plus an approval step for anything client-facing.

```bash
npm install -g @agent-receipts/magic-folder
magic-folder init ~/"Magic Folder"
magic-folder run ~/"Magic Folder" --engine ollama --issuer "Your Studio"
```

Needs Node 22.16 or later and, for free local jobs, [Ollama](https://ollama.com). Step-by-step for Mac, Windows and Linux: [receipts.webaes.com/install](https://receipts.webaes.com/install).

The runner writes the receipt, not the agent: it hashes the real files and records the model, time and cost itself (on Claude, the cost is the Agent SDK's own estimate and is marked as one; on Ollama it's $0). See [packages/magic-folder](packages/magic-folder) and the static [verify page](apps/verify).

## Memory

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

The agent handles this automatically when you add the [system prompt](#2-add-the-system-prompt). You don't manage memory manually.

### Portable memory bundles

Export your agent's entire memory as a single verifiable file:

```bash
npx @agent-receipts/cli memory export > my-project.bundle.json
```

The bundle includes every entity, observation, relationship, the receipts that created them, and the public key needed to verify everything. Hand it to another agent, another team, or another Agent Receipts instance — they can verify every fact without trusting you.

## The Problem

You're building with AI agents. Claude Code refactors your auth module and says "done, all tests pass." Your agent generates a customer quote and says it applied the right pricing. Your assistant remembers your preferences from last week — but you can't see why it thinks that, or whether it's right.

Three things are broken:

1. **Agents forget everything between sessions.** Every conversation starts from zero. Context is lost. You re-explain the same things.

2. **When agents do remember, you can't see inside.** Platform memory is a black box. You can't see what it stored, when, or why. You can't correct it, export it, or verify it.

3. **There's no proof of what agents actually did.** Logs are mutable. Agents write their own logs. "I updated 3 files and all tests pass" — did it? You're trusting the agent's word about its own work.

## Why This Exists

The idea came from building [ModQuote](https://modquote.io), a multi-tenant SaaS for automotive protection and detailing shops: PPF, ceramic coatings, window tint.

AI-drafted quotes are on ModQuote's roadmap, and designing that feature raised a question I couldn't answer with the tools I had. If an agent drafts a $2,400 PPF quote and the customer disputes the price, how do I show what vehicle data it received and which pricing rules it applied? Not with a log entry the agent wrote about itself, but with proof that someone outside my system can check.

Memory tools could tell me what an agent remembered, and observability tools could tell me what happened inside my own pipeline. Neither gave me a record that a customer, a client or an auditor could verify without trusting me.

So I built Agent Receipts first, as its own open-source project. When AI quoting ships in ModQuote, every quote will come with a signed receipt. Until then, Agent Receipts stands on its own: any agent, any client, any workflow.

## How It's Different

Most AI tooling answers one of two questions. Memory tools answer *"What does my agent remember?"* Observability tools answer *"What happened in my pipeline?"* Agent Receipts answers a third: **"Can you prove it?"**

- **Proof, not logs.** Every receipt is signed with Ed25519 over every field (format v2). Logs can be edited and are written by the agent about itself; a receipt breaks if anything changes.
- **Anyone can verify it.** Offline, in a browser, from the CLI or in code, with a public key. No account, no server, no trusting the person who sent it.
- **History you can't quietly rewrite.** Receipts link to the one before them, and `verify-chain` detects edited, removed or forked receipts.
- **Memory with provenance.** Every fact your agent remembers links to the receipt that created it, and can be exported as a bundle someone else can verify.
- **Local-first and free.** `npx` and done. Keys and receipts stay in `~/.agent-receipts`. MIT licensed.

## What's Inside

- **Automatic receipts** — Claude Code hooks (and a plugin) and an MCP proxy that sign every action as it happens
- **24 MCP tools** — memory, actions, verification, constraints, judgments, invoicing, bundles
- **21 SDK methods** — full TypeScript API
- **17 CLI commands + 9 memory and 3 hooks subcommands** — terminal-first
- **20 dashboard pages** — receipts, sessions, memory graph, chains, agents, constraints, judgments, invoices
- **714 tests** (697 across the packages, 17 for the website) — zero TypeScript `any` in package source
- **Ed25519 + SHA-256** — via `@noble/ed25519` (pure JS, no native code); receipt format v2 signs every field
- **SQLite + FTS5** — Node's built-in SQLite, local-first with full-text memory search; no native modules to install

## Links

| | |
|---|---|
| [Interactive Demo](https://demo.receipts.webaes.com/walkthrough) | Try it in your browser — 60 seconds |
| [Live Dashboard](https://demo.receipts.webaes.com) | See the full dashboard with sample data |
| [How It Works](https://demo.receipts.webaes.com/how-it-works) | Receipt anatomy, memory model, a worked quoting example |
| [npm](https://www.npmjs.com/org/agent-receipts) | All 7 packages |
| [receipts.webaes.com](https://receipts.webaes.com) | Magic Folder, install guide for Mac, Windows and Linux |
| [verify.webaes.com](https://verify.webaes.com) | A real issuer's verify page |

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
| `verify-chain <chain_id>` | Verify every signature and link in a chain |
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

| Package | Version | Description |
|---------|---------|-------------|
| [`@agent-receipts/schema`](packages/schema) | 0.6.0 | Zod schemas and TypeScript types |
| [`@agent-receipts/crypto`](packages/crypto) | 0.6.0 | Ed25519 signing, verification, key management |
| [`@agent-receipts/mcp-server`](packages/mcp-server) | 0.6.0 | MCP server with 24 tools |
| [`@agent-receipts/sdk`](packages/sdk) | 0.6.0 | TypeScript SDK (21 methods) |
| [`@agent-receipts/cli`](packages/cli) | 0.6.0 | Command-line interface, Claude Code hooks, MCP proxy |
| [`@agent-receipts/dashboard`](packages/dashboard) | 0.6.0 | Mission Control web UI, on your own computer |
| [`@agent-receipts/magic-folder`](packages/magic-folder) | 0.2.0 | Drop-a-file job runner with signed, self-checking receipts |

All MIT, all on [npm](https://www.npmjs.com/org/agent-receipts). Node.js 22.16 or later, using its built-in SQLite. (Node 22, and 24 before 24.15, call built-in SQLite experimental; Agent Receipts hides that one notice.)

## Roadmap

- [ ] **Cloud tier** — team dashboards, multi-agent memory sync, cross-org verification
- [ ] **Semantic recall** — embedding-powered memory search
- [ ] **Framework adapters** — LangChain, CrewAI, AutoGen integrations
- [ ] **Cross-org trust bridges** — two organizations verifying each other's agent receipts

## License

MIT

---

Built by [Amin Suleiman](https://webaes.com) — building [ModQuote](https://modquote.io) and [Agent Receipts](https://github.com/webaesbyamin/agent-receipts).
