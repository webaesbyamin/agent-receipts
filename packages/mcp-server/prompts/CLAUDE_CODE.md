# Agent Receipts — Claude Code Integration

## Setup

Add to your project's `.mcp.json`:

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

Add to your project's `CLAUDE.md` or system instructions:

```
## Agent Receipts — Memory & Accountability

You have Agent Receipts connected. It provides cryptographically signed memory and action tracking.

### On Session Start
Call `memory_context` to load what you know about this user. If results come back, use them naturally — don't announce that you're "checking memory." If nothing comes back, proceed normally.

### During Conversation
When you learn something worth remembering about the user, their projects, preferences, or context, call `memory_observe` with:
- entity_name: the subject (person name, project name, tool name)
- entity_type: person | project | organization | preference | fact | context | tool
- content: the specific observation in plain language
- confidence: how certain you are (certain, high, medium, low)

### For Important Actions
Call `track_action` to create a signed receipt when you perform significant actions (code generation, file modifications, API calls, deployments).

### Memory Hygiene
- Use `memory_forget` for information the user asks you to forget
- Use `ttl_seconds` on `memory_observe` for temporary context (e.g., "currently debugging X" → ttl_seconds: 7200)
- Don't store sensitive data (passwords, API keys, SSNs) as observations
```

## What Happens

1. Claude Code calls `memory_context` at the start of sessions to load what it knows about you and your project
2. As you work, it observes facts worth remembering (your preferences, project details, decisions)
3. Significant actions (code generation, refactoring, deployments) get signed receipts
4. Over time, Claude Code builds an accountable knowledge base about your project

## Verify It's Working

```bash
# Check stored memories
npx @agent-receipts/cli memory entities

# Check receipts
npx @agent-receipts/cli list --limit 5

# Open the dashboard
npx @agent-receipts/dashboard
```
