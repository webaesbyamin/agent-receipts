# @agent-receipts/mcp-server

Local-first MCP server for [Agent Receipts](https://github.com/webaesbyamin/agent-receipts). Cryptographically signed, verifiable proof for every AI agent action. No hosted server required.

## Quick Start

Add to your MCP client config and every agent action gets a cryptographic receipt automatically.

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

## Tools

The MCP server exposes 24 tools:

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
| `generate_invoice` | Generate an invoice from receipts | `from`, `to`, `format`, `agent_id` |
| `get_started` | Show a getting-started guide with usage examples | -- |
| `memory_observe` | Store a memory observation about an entity | `entity_name`, `entity_type`, `content`, `ttl_seconds` |
| `memory_recall` | Search and retrieve stored memories | `query`, `entity_type`, `scope` |
| `memory_forget` | Soft-delete an observation or entity | `entity_id` or `observation_id` |
| `memory_entities` | List known entities with filtering | `entity_type`, `scope`, `query` |
| `memory_relate` | Create a relationship between two entities | `from_entity_id`, `to_entity_id`, `relationship_type` |
| `memory_provenance` | Get the provenance chain for an observation | `observation_id` |
| `memory_context` | Get a structured memory context summary | `entity_type`, `scope`, `agent_id` |
| `memory_audit` | Generate a memory operations audit report | `agent_id`, `from`, `to` |
| `memory_export_bundle` | Export memories as a portable, verifiable bundle | `entity_ids`, `include_receipts` |
| `memory_import_bundle` | Import and verify a memory bundle | `bundle`, `skip_existing` |

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `AGENT_RECEIPTS_DATA_DIR` | Data directory path | `~/.agent-receipts` |
| `AGENT_RECEIPTS_AGENT_ID` | Default agent ID | `default-agent` |
| `AGENT_RECEIPTS_ORG_ID` | Organization ID | `default-org` |
| `AGENT_RECEIPTS_ENVIRONMENT` | Environment label | `production` |
| `RECEIPT_SIGNING_PRIVATE_KEY` | Ed25519 private key (hex) | Auto-generated |
| `RECEIPT_SIGNING_PUBLIC_KEY` | Ed25519 public key (hex) | Derived from private |

## Programmatic Usage

The engine and storage classes are exported for use by `@agent-receipts/sdk` and custom integrations:

```typescript
import { ReceiptEngine, ReceiptStore, KeyManager, ConfigManager } from '@agent-receipts/mcp-server'

const store = new ReceiptStore('/path/to/data')
await store.init()
const keyManager = new KeyManager('/path/to/data')
await keyManager.init()
const configManager = new ConfigManager('/path/to/data')
await configManager.init()
const engine = new ReceiptEngine(store, keyManager, configManager)

const receipt = await engine.track({ action: 'my_action', input: 'data' })
```

## License

MIT
