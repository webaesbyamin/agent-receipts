# @agent-receipts/cli

Command-line interface for Agent Receipts. Inspect receipts, search memories, verify signatures, export bundles, and manage your local receipt store from the terminal.

[Full Documentation](https://github.com/webaesbyamin/agent-receipts)

## Install

```bash
npm install -g @agent-receipts/cli
```

Or use directly with npx:

```bash
npx @agent-receipts/cli <command>
```

## Quick Start

```bash
# Generate signing keys
npx @agent-receipts/cli init

# Show your public key (share this for third-party verification)
npx @agent-receipts/cli keys

# List all receipts
npx @agent-receipts/cli list

# Verify a receipt
npx @agent-receipts/cli verify <receipt-id>
```

## Commands

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

## License

MIT
