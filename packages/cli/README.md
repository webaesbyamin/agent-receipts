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
| `proxy [--name <n>] -- <command>` | Run an MCP server behind a proxy that signs every tool call |

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

## Receipts for any MCP server: the proxy

Put `agent-receipts proxy` in front of any stdio MCP server, and every tool call through it gets a signed receipt:

```bash
agent-receipts proxy [--name <server-name>] -- <command> [args...]
```

- **Unchanged traffic.** Every message passes through as is, both ways (initialize, notifications, resources, prompts, progress, cancellation). The proxy only watches `tools/call` requests and their responses.
- **One receipt per tool call:** action `mcp.<name>.<tool>`, one chain per proxy session, hashes of the arguments and the result (never the values), latency, and `failed` when the result has `isError` or the server returns a JSON-RPC error. A cancelled call, or one the server never answered before exiting, is a failed receipt too.
- **Never in the way.** The response goes to the client first; the receipt is signed after, in the same process. Problems go to `~/.agent-receipts/proxy.log`, never to the client. The server's exit code and signals pass through.
- **stdio only.** Remote (HTTP) MCP servers aren't covered yet.

**Claude Code:**

```bash
claude mcp add fs-receipted -- npx -y @agent-receipts/cli proxy --name fs -- npx -y @modelcontextprotocol/server-filesystem ~/Documents
```

**Claude Desktop** (`claude_desktop_config.json`: Settings → Developer → Edit Config) and **Cursor** (`~/.cursor/mcp.json`, or `.cursor/mcp.json` in a project) use the same shape:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y", "@agent-receipts/cli", "proxy", "--name", "fs", "--",
        "npx", "-y", "@modelcontextprotocol/server-filesystem", "/Users/you/Documents"
      ]
    }
  }
}
```

To put an existing server behind the proxy, keep its `command` and `args`, and move them after `"--"`. Check a session with `agent-receipts list --agent mcp-proxy` and `agent-receipts verify-chain <chain id>`.

## License

MIT
