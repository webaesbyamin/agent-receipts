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
| `verify-chain <chain_id>` | Check every signature and link in a chain |
| `hooks install` | Sign a receipt for every Claude Code action (see below) |
| `hooks uninstall` | Remove the hooks, leaving settings.json as it was |
| `hooks status` | Where the hooks are installed, and any problems logged |

## Automatic receipts for Claude Code

```bash
npx @agent-receipts/cli hooks install                    # every project (~/.claude/settings.json)
npx @agent-receipts/cli hooks install --scope project    # this repo (.claude/settings.json)
npx @agent-receipts/cli hooks install --scope local      # this repo, just you (.claude/settings.local.json)
```

Install shows the change to settings.json and asks first (`--yes` skips the question). From the next Claude Code session on, every file edit, file write, notebook edit and shell command gets its own signed receipt, chained per session (`chain_id` is Claude Code's session ID), and the session ends with a summary receipt: how many actions, which files, how long.

- **Hashes only.** A receipt holds the SHA-256 of the tool's input and output and of each changed file (named relative to the project), never a command, file contents or output. `--store-commands` adds a short label for shell commands, such as `git commit …`, that keeps the program and subcommand and drops everything else.
- **Never in Claude Code's way.** The hooks run in the background (`async`), print nothing, and always exit 0. Problems go to `~/.agent-receipts/hooks.log`. Each receipt is signed in its own hook process the moment the tool finishes: about 90 ms on Node 22–26.
- **Check a session:** `agent-receipts verify-chain <session id>`.
- In `claude -p` runs, Claude Code stops background hooks that are still running when the run ends, so a tool call in the last moment of a run can go unrecorded.

The same hooks come as a Claude Code plugin:

```bash
claude plugin marketplace add webaesbyamin/agent-receipts
claude plugin install agent-receipts@agent-receipts
```

Requires Node.js 22.16 or later on your `PATH`.

## License

MIT
