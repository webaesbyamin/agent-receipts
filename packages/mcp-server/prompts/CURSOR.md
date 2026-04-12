# Agent Receipts — Cursor Integration

## Setup

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

## System Prompt

Add to Cursor's custom instructions (Settings > Rules for AI):

```
You have Agent Receipts connected. It provides cryptographically signed memory and action tracking.

On session start, call `memory_context` to load what you know about this user.

When you learn something worth remembering, call `memory_observe` with entity_name, entity_type, content, and confidence.

For important actions (code generation, file modifications), call `track_action` to create a signed receipt.

Use `memory_recall` to search stored memories when you need context.
Use `memory_forget` for information the user asks you to forget.
```

## Verify It's Working

```bash
npx @agent-receipts/cli memory entities
npx @agent-receipts/cli list --limit 5
npx @agent-receipts/dashboard
```
