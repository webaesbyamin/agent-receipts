# @agent-receipts/dashboard

Mission Control dashboard for [Agent Receipts](https://github.com/webaesbyamin/agent-receipts) — a local web UI for visualizing, verifying, and managing AI agent receipts.

## Quick Start

```bash
npx @agent-receipts/dashboard
```

Opens `http://localhost:3274` — the dashboard reads from `~/.agent-receipts/` automatically.

## Options

```bash
npx @agent-receipts/dashboard --port=8080    # Custom port
npx @agent-receipts/dashboard --no-open      # Don't open browser
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_RECEIPTS_DATA_DIR` | `~/.agent-receipts` | Data directory to read from |
| `PORT` | `3274` | Server port |

## What You'll See

- **Overview** — stat cards, charts, recent receipts, agent activity
- **Receipt Explorer** — search, filter, sort, export all receipts
- **Receipt Detail** — every field, constraints, judgments, chain, signature verification
- **Chain Explorer** — timeline and tree views of multi-step workflows
- **Agent Directory** — per-agent stats and trends
- **Constraints** — pass/fail analytics across all constraint types
- **Judgments** — AI Judge activity and scores
- **Invoices** — generate professional invoices from receipts
- **Verify** — paste any receipt JSON + public key to verify signatures
- **Settings** — configuration, storage management, cleanup

Dark mode, global search (Cmd+K), auto-refresh.

## Prerequisites

Requires receipts to exist in `~/.agent-receipts/`. Create them via:

- **MCP Server:** `npx @agent-receipts/mcp-server` (add to Claude Desktop, Cursor, etc.)
- **SDK:** `npm install @agent-receipts/sdk`
- **CLI:** `npx @agent-receipts/cli init`

## License

MIT
