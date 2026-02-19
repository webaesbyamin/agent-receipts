# Agent Receipts

**Cryptographically signed proof that an AI agent did what it said it did.**

Agent Receipts is a local-first, open-source system for creating verifiable, immutable receipts of autonomous agent actions. Every action is Ed25519-signed, content-hashed, and chain-linked — no hosted API required. Works as an MCP server, Node.js SDK, or CLI.

## Quick Start: MCP Server

Add the Agent Receipts MCP server to your AI tool's config and every action gets a cryptographic receipt automatically.

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

## MCP Tools Reference

The MCP server exposes 8 tools that AI agents can call directly:

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `track_action` | Track an agent action with automatic hashing | `action`, `input`, `output`, `status` |
| `create_receipt` | Create a receipt with pre-computed hashes | `action`, `input_hash`, `output_hash` |
| `complete_receipt` | Complete a pending receipt with results | `receipt_id`, `output`, `status` |
| `verify_receipt` | Verify the cryptographic signature of a receipt | `receipt_id` |
| `get_receipt` | Retrieve a receipt by ID | `receipt_id` |
| `list_receipts` | List receipts with optional filtering | `agent_id`, `status`, `chain_id` |
| `get_chain` | Get all receipts in a chain ordered by timestamp | `chain_id` |
| `get_public_key` | Export the Ed25519 public key for verification | — |

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
// result.pagination: { page, pageSize, total }
```

### `ar.getPublicKey()` — Get the signing public key

```typescript
const publicKey = await ar.getPublicKey()
// 64-char hex string (Ed25519 public key)
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
| `export <id>` | Export a single receipt as JSON |
| `export --all` | Export all receipts as compact JSON |
| `export --all --pretty` | Export all receipts as formatted JSON |

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
  "model": "claude-sonnet-4-6",
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
| `AGENT_RECEIPTS_AGENT_ID` | Default agent ID | `default-agent` |
| `AGENT_RECEIPTS_ORG_ID` | Organization ID | `default-org` |
| `AGENT_RECEIPTS_ENVIRONMENT` | Environment label | `production` |
| `RECEIPT_SIGNING_PRIVATE_KEY` | Ed25519 private key (hex) | Auto-generated |
| `RECEIPT_SIGNING_PUBLIC_KEY` | Ed25519 public key (hex) | Derived from private |

## Storage

All data is stored locally in the data directory:

```
~/.agent-receipts/
├── keys/
│   ├── private.key          # Ed25519 private key (mode 0600)
│   └── public.key           # Ed25519 public key
├── receipts/
│   └── *.json               # Individual receipt files
└── config.json              # Agent and org configuration
```

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

## Examples

| Example | Description |
|---------|-------------|
| [`examples/basic`](./examples/basic) | Simple action tracking with verification |
| [`examples/chained`](./examples/chained) | Multi-step pipeline with parent/child receipt linking |
| [`examples/modquote`](./examples/modquote) | Content moderation pipeline with chained receipts |

## Packages

| Package | Description |
|---------|-------------|
| `@agent-receipts/schema` | Zod schemas and TypeScript types for the Action Receipt Protocol |
| `@agent-receipts/crypto` | Ed25519 signing, verification, and key management |
| `@agent-receipts/mcp-server` | MCP protocol server with receipt engine and storage |
| `@agent-receipts/sdk` | High-level Node.js SDK for tracking and verifying receipts |
| `@agent-receipts/cli` | Command-line tool for managing receipts |

## Roadmap

- [x] Local-first receipt storage with SQLite/JSON
- [x] Ed25519 signing and verification
- [x] MCP server with 8 tools
- [x] Node.js SDK
- [x] CLI with full command set
- [ ] Receipt anchoring to blockchain/timestamping services
- [ ] Multi-agent receipt sharing protocol
- [ ] Web dashboard for receipt visualization
- [ ] Receipt compression and archival

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm dev
```

## License

MIT — see [LICENSE](./LICENSE)
