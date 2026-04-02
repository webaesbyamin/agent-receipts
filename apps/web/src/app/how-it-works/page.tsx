'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-lg font-semibold text-text-primary mb-4 pb-2 border-b border-border">{title}</h2>
      <div className="space-y-4 text-sm text-text-secondary leading-relaxed">{children}</div>
    </section>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 font-mono text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">{children}</pre>
  )
}

export default function HowItWorksPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <div>
        <h1 className="text-xl font-bold text-text-primary">How Agent Receipts Works</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Cryptographically signed, immutable proof of autonomous AI agent actions. Local-first. No server required.
        </p>
      </div>

      {/* Section 1 */}
      <Section id="what-is-a-receipt" title="What Is a Receipt?">
        <p>
          <strong className="text-text-primary">Logs</strong> are internal, mutable, developer-only, and unverifiable.
          Anyone can edit a log entry after the fact.
        </p>
        <p>
          <strong className="text-text-primary">Receipts</strong> are cryptographically signed, immutable, shareable, and independently verifiable.
          Once signed, tampering is detectable by anyone with the public key.
        </p>
        <Code>{`{
  receipt_id:    "rcpt_abc123"         // unique identifier
  agent_id:      "my-agent"           // who acted
  action:        "generate_code"      // what they did
  input_hash:    "sha256:..."         // what they received (hashed)
  output_hash:   "sha256:..."         // what they produced (hashed)
  status:        "completed"          // outcome
  timestamp:     "2026-04-02T..."     // when
  signature:     "ed25519:..."        // cryptographic proof
}`}</Code>
        <p>The full schema has 29 fields covering identity, timing, performance metrics, constraints, judgments, and cryptographic proof.</p>
      </Section>

      {/* Section 2 */}
      <Section id="cryptographic-proof" title="Cryptographic Proof">
        <p>Every receipt is signed with Ed25519 — the same algorithm used by SSH, Signal, and TLS 1.3.</p>
        <Code>{`How signing works:
1. Generate a key pair (private + public) — stored locally
2. When an action completes, 12 fields are extracted into a signable payload
3. Fields are sorted alphabetically and JSON-serialized (canonical form)
4. The payload is signed with your private key using Ed25519
5. Signature stored on receipt as "ed25519:<base64>"

The 12 signed fields:
  action, agent_id, chain_id, completed_at, environment,
  input_hash, org_id, output_hash, receipt_id,
  receipt_type, status, timestamp`}</Code>
        <p>
          <strong className="text-text-primary">To verify:</strong> anyone with your public key can re-canonicalize the same 12 fields and check the signature — no server required.
        </p>
        <p>Input and output data is never stored — only SHA-256 hashes. Prove what was processed without exposing the data itself.</p>
        {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              In this demo, signatures are placeholders (<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">ed25519:DEMO_...</code>).
              In a real installation, every receipt is cryptographically signed using your locally-generated Ed25519 private key.
            </p>
          </div>
        )}
      </Section>

      {/* Section 3 */}
      <Section id="chains" title="Receipt Chains">
        <p>Multi-step workflows are linked together as chains. Each step references the previous via <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">parent_receipt_id</code>.</p>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-border font-mono text-xs space-y-1">
          <p className="text-text-muted mb-2">Example: Code review pipeline (chain_abc)</p>
          <div className="flex items-center gap-2">
            <span className="w-14 text-text-muted">Step 1</span>
            <span className="w-32">fetch_code</span>
            <span className="text-success">completed</span>
            <span className="text-text-muted ml-auto">0.8s &middot; $0.01</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-text-muted">Step 2</span>
            <span className="w-32">analyze_code</span>
            <span className="text-success">completed</span>
            <span className="text-text-muted ml-auto">3.2s &middot; $0.04</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-text-muted">Step 3</span>
            <span className="w-32">generate_report</span>
            <span className="text-success">completed</span>
            <span className="text-text-muted ml-auto">2.1s &middot; $0.03</span>
          </div>
          <div className="pt-2 border-t border-border/50 text-text-muted">
            Total: 6.1s &middot; $0.08 &middot; 3 receipts
          </div>
        </div>
        <p>Benefits: full history of complex workflows, identify which step caused a failure, total cost/duration across the workflow, track which agents were involved at each stage.</p>
      </Section>

      {/* Section 4 */}
      <Section id="constraints" title="Constraints">
        <p>Define rules that receipts must satisfy. Evaluated at creation/completion time. Results stored on the receipt — no re-evaluation needed.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-text-primary">Type</th>
                <th className="text-left py-2 font-medium text-text-primary">Passes if</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <tr><td className="py-2 pr-4 font-mono">max_latency_ms</td><td className="py-2">latency_ms &le; value</td></tr>
              <tr><td className="py-2 pr-4 font-mono">max_cost_usd</td><td className="py-2">cost_usd &le; value</td></tr>
              <tr><td className="py-2 pr-4 font-mono">min_confidence</td><td className="py-2">confidence &ge; value</td></tr>
              <tr><td className="py-2 pr-4 font-mono">required_fields</td><td className="py-2">all named fields are non-null</td></tr>
              <tr><td className="py-2 pr-4 font-mono">status_must_be</td><td className="py-2">status is in the allowed list</td></tr>
              <tr><td className="py-2 pr-4 font-mono">output_schema</td><td className="py-2">output validates against JSON Schema</td></tr>
            </tbody>
          </table>
        </div>
        <Code>{`constraints: [
  { type: "max_latency_ms", value: 5000 },
  { type: "max_cost_usd", value: 0.10 },
  { type: "min_confidence", value: 0.8 }
]`}</Code>
      </Section>

      {/* Section 5 */}
      <Section id="ai-judgment" title="AI Judgment">
        <p>An AI model can evaluate receipt outputs against a rubric — and the evaluation itself is stored as a signed receipt.</p>
        <Code>{`Judgment flow:
1. Define a rubric (criteria with weights and thresholds)
2. Call judge_receipt with the receipt ID and rubric
3. A pending judgment receipt is created
4. An AI model evaluates the output against each criterion
5. Judgment completed with verdict (pass/fail/partial) and score (0-1)

Example rubric:
  Accuracy      weight: 0.4  threshold: 0.7
  Completeness  weight: 0.3  threshold: 0.6
  Clarity       weight: 0.3  threshold: 0.7`}</Code>
        <p>Judgments are stored as receipts themselves (<code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">receipt_type: &quot;judgment&quot;</code>) — signed, immutable, and verifiable.</p>
      </Section>

      {/* Section 6 */}
      <Section id="getting-started" title="Getting Started">
        <p className="font-medium text-text-primary">MCP Server (for Claude, Cursor, VS Code):</p>
        <Code>{`{
  "mcpServers": {
    "agent-receipts": {
      "command": "npx",
      "args": ["@agent-receipts/mcp-server"]
    }
  }
}`}</Code>

        <p className="font-medium text-text-primary pt-2">TypeScript SDK:</p>
        <Code>{`import { AgentReceipts } from '@agent-receipts/sdk'

const client = new AgentReceipts()
await client.track({
  action: 'generate_code',
  input: { prompt },
  output: { code },
  model: 'claude-sonnet-4-20250514',
  tokens_in: 1200,
  tokens_out: 400,
  cost_usd: 0.008,
  latency_ms: 2100,
})`}</Code>

        <p className="font-medium text-text-primary pt-2">CLI:</p>
        <Code>{`npx @agent-receipts/cli init
npx @agent-receipts/cli list
npx @agent-receipts/cli verify <receipt-id>
npx @agent-receipts/cli stats`}</Code>

        <p>All receipts stored locally in <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">~/.agent-receipts/</code>. Your private key never leaves your machine.</p>

        <div className="pt-4">
          <a
            href="https://github.com/webaesbyamin/agent-receipts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            View on GitHub <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </Section>
    </div>
  )
}
