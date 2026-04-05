import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'

const guideMarkdown = `# Agent Receipts — Getting Started

Welcome to Agent Receipts! This guide covers the key tools available to you.

## 1. Track an Action (\`track_action\`)

The simplest way to create a receipt. Automatically hashes input/output and signs the receipt.

\`\`\`
track_action({
  action: "summarize_text",
  input: { text: "..." },
  output: { summary: "..." },
  model: "claude-sonnet-4-20250514",
  tokens_in: 500,
  tokens_out: 150,
  cost_usd: 0.003,
  latency_ms: 1200,
  tags: ["production"]
})
\`\`\`

## 2. Two-Phase Workflow (\`create_receipt\` + \`complete_receipt\`)

For long-running tasks, create a pending receipt first, then complete it when done.

**Phase 1 — Create pending:**
\`\`\`
create_receipt({
  action: "generate_report",
  input_hash: "sha256:...",
  status: "pending"
})
\`\`\`

**Phase 2 — Complete:**
\`\`\`
complete_receipt({
  receipt_id: "rcpt_...",
  status: "completed",
  output_hash: "sha256:...",
  output_summary: "Report generated successfully"
})
\`\`\`

## 3. Constraints

Add quality gates that are automatically evaluated on completion:

\`\`\`
track_action({
  action: "fast_lookup",
  input: { query: "..." },
  output: { result: "..." },
  latency_ms: 800,
  cost_usd: 0.001,
  constraints: [
    { type: "max_latency_ms", value: 2000 },
    { type: "max_cost_usd", value: 0.01 },
    { type: "min_confidence", value: 0.8 }
  ]
})
\`\`\`

Available constraint types: \`max_latency_ms\`, \`max_cost_usd\`, \`min_confidence\`, \`required_fields\`, \`status_must_be\`, \`output_schema\`.

## 4. AI Judge (\`judge_receipt\` + \`complete_judgment\`)

Evaluate receipt quality against a rubric:

\`\`\`
judge_receipt({
  receipt_id: "rcpt_...",
  rubric: {
    criteria: [
      { name: "accuracy", description: "Is the output correct?", weight: 0.6 },
      { name: "clarity", description: "Is the output clear?", weight: 0.4 }
    ],
    passing_threshold: 0.7
  }
})
\`\`\`

Then complete the judgment with your evaluation using \`complete_judgment\`.

## 5. Chains

Link related receipts using \`parent_receipt_id\` and \`chain_id\`:

\`\`\`
// Step 1
track_action({ action: "step_1", input: "start", chain_id: "chain_abc" })

// Step 2 (linked to step 1)
track_action({
  action: "step_2",
  input: "continue",
  chain_id: "chain_abc",
  parent_receipt_id: "rcpt_step1..."
})
\`\`\`

Retrieve a chain with \`get_chain({ chain_id: "chain_abc" })\`.

## 6. Query & Verify

- **\`list_receipts\`** — Filter by agent, action, status, tags, date range
- **\`get_receipt\`** — Fetch a single receipt by ID
- **\`verify_receipt\`** — Cryptographically verify a receipt's signature
- **\`get_judgments\`** — Get all judgments for a receipt
- **\`get_public_key\`** — Retrieve the signing public key

## 7. Maintenance

- **\`cleanup_expired\`** — Delete receipts past their \`expires_at\` date
- **\`generate_invoice\`** — Generate invoices from receipt data

## All Available Tools

| Tool | Purpose |
|------|---------|
| \`track_action\` | Create a completed receipt (auto-hash) |
| \`create_receipt\` | Create a receipt with pre-computed hashes |
| \`complete_receipt\` | Complete a pending receipt |
| \`verify_receipt\` | Verify receipt signature |
| \`get_receipt\` | Get receipt by ID |
| \`list_receipts\` | List/filter receipts |
| \`get_chain\` | Get all receipts in a chain |
| \`get_public_key\` | Get signing public key |
| \`judge_receipt\` | Start a judgment evaluation |
| \`complete_judgment\` | Complete a judgment |
| \`get_judgments\` | Get judgments for a receipt |
| \`cleanup_expired\` | Delete expired receipts |
| \`generate_invoice\` | Generate invoice from receipts |
| \`get_started\` | Show this guide |
`

export function registerGetStarted(server: McpServer, _engine: ReceiptEngine): void {
  server.tool(
    'get_started',
    'Display a getting-started guide with usage examples for all Agent Receipts tools. Shows how to record agent actions, verify receipts, use receipt chains, evaluate with constraints, and generate invoices. Call this tool first when setting up Agent Receipts or when you need a reference for available tools and their typical usage patterns.',
    {},
    async () => {
      return {
        content: [{ type: 'text' as const, text: guideMarkdown }],
      }
    },
  )
}
