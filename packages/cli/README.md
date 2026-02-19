# @agentreceipts/cli

Command-line tool for [Agent Receipts](https://github.com/webaesbyamin/agent-receipts). Inspect, verify, and manage cryptographically signed receipts.

## Install

```bash
npm install -g @agentreceipts/cli
```

Or use directly with npx:

```bash
npx @agentreceipts/cli <command>
```

## Quick Start

```bash
# Generate signing keys
npx @agentreceipts/cli init

# Show your public key (share this for third-party verification)
npx @agentreceipts/cli keys

# List all receipts
npx @agentreceipts/cli list

# Verify a receipt
npx @agentreceipts/cli verify <receipt-id>
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
| `export <id>` | Export a single receipt as JSON |
| `export --all` | Export all receipts as compact JSON |
| `export --all --pretty` | Export all receipts as formatted JSON |

## License

MIT
