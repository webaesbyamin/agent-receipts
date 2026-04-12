'use client'

import Link from 'next/link'
import { ArrowRight, ShieldCheck, Brain, FileCheck, Zap, Link2, Scale, Package, Check, X } from 'lucide-react'

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-lg font-semibold text-text-primary mb-4 pb-2 border-b border-border flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5 text-primary" />}
        {title}
      </h2>
      <div className="space-y-4 text-sm text-text-secondary leading-relaxed">{children}</div>
    </section>
  )
}

function ReceiptField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-xs text-text-muted w-24 shrink-0 font-mono">{label}</span>
      <span className={`text-xs font-mono ${highlight ? 'text-primary font-medium' : 'text-text-primary'}`}>{value}</span>
    </div>
  )
}

function CompareRow({ feature, ar, mem0, langfuse, zep }: { feature: string; ar: string; mem0: string; langfuse: string; zep: string }) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-2 pr-4 text-xs font-medium text-text-primary">{feature}</td>
      <td className="py-2 pr-4 text-xs text-primary font-medium">{ar}</td>
      <td className="py-2 pr-4 text-xs text-text-secondary">{mem0}</td>
      <td className="py-2 pr-4 text-xs text-text-secondary">{langfuse}</td>
      <td className="py-2 text-xs text-text-secondary">{zep}</td>
    </tr>
  )
}

export default function HowItWorksPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <div>
        <h1 className="text-xl font-bold text-text-primary">How Agent Receipts Works</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Persistent memory backed by cryptographic proof. Here&apos;s what&apos;s happening under the hood.
        </p>
      </div>

      {/* Section 1: Memory That Persists */}
      <Section id="memory-that-persists" title="Memory That Persists" icon={Brain}>
        <p>Your agent gets structured, persistent memory across sessions. Not a black box — an entity-observation graph you can inspect, search, export, and verify.</p>

        <div className="card p-4 font-mono text-xs">
          <div className="text-text-muted mb-2">Session 1: Agent learns things</div>
          <div className="ml-4 space-y-1 text-text-primary">
            <div>memory_observe → &quot;User prefers TypeScript&quot; → signed receipt</div>
            <div>memory_observe → &quot;Building a SaaS called ModQuote&quot; → signed receipt</div>
            <div>memory_observe → &quot;Uses Neovim&quot; → signed receipt</div>
          </div>
          <div className="border-t border-border/50 mt-3 pt-3 text-text-muted">Session 2: Agent already knows</div>
          <div className="ml-4 space-y-1 text-text-primary mt-1">
            <div>memory_context → 3 observations loaded → no re-explaining</div>
          </div>
        </div>

        <p>Every observation is linked to a signed receipt. You can trace any memory back to the exact conversation that created it.</p>
      </Section>

      {/* Section 2: Why Receipts, Not Just Logs */}
      <Section id="why-receipts" title="Why Receipts, Not Just Logs" icon={FileCheck}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4">
            <div className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">Log Entry</div>
            <div className="font-mono text-xs text-text-secondary space-y-1">
              <div>&quot;Generated quote: $2,400&quot;</div>
              <div className="text-text-muted italic mt-2">text, mutable, no proof</div>
              <div className="text-text-muted italic">written by the agent about itself</div>
            </div>
          </div>
          <div className="card p-4 border-primary/30">
            <div className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Receipt</div>
            <div className="font-mono text-xs space-y-0.5">
              <ReceiptField label="receipt_id" value="rcpt_8f3k2j4n" />
              <ReceiptField label="action" value="generate_ppf_quote" />
              <ReceiptField label="input_hash" value="sha256:abc123..." />
              <ReceiptField label="output_hash" value="sha256:def456..." />
              <ReceiptField label="signature" value="ed25519:7f3a..." highlight />
            </div>
            <div className="text-text-muted italic text-xs mt-2">signed, immutable, verifiable by anyone</div>
          </div>
        </div>

        <p>Input and output are <strong className="text-text-primary">SHA-256 hashed</strong> — raw data never leaves your machine. The receipt proves what was processed without exposing the data itself.</p>
      </Section>

      {/* Section 3: Accountable Memory Detail */}
      <Section id="accountable-memory" title="Entity-Observation Model" icon={Brain}>
        <p>AI agents remember things. Agent Receipts makes those memories <strong className="text-text-primary">provable</strong>.</p>
        <p>Every memory is an <strong className="text-text-primary">entity</strong> (person, project, tool, preference) with <strong className="text-text-primary">observations</strong> — each linked to a signed receipt.</p>

        <div className="card p-4 font-mono text-xs">
          <div className="text-text-muted mb-2">Entity: &quot;Customer&quot; (person)</div>
          <div className="ml-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-text-muted">├──</span>
              <span className="text-text-primary">&quot;Prefers full-front PPF coverage&quot;</span>
              <span className="text-success text-[10px] px-1.5 py-0.5 rounded bg-success/10">high</span>
              <span className="text-text-muted">← signed receipt</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">├──</span>
              <span className="text-text-primary">&quot;Owns a Tesla Model 3&quot;</span>
              <span className="text-primary text-[10px] px-1.5 py-0.5 rounded bg-primary/10">certain</span>
              <span className="text-text-muted">← signed receipt</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">└──</span>
              <span className="text-text-primary">works_on → &quot;PPF Quote #1247&quot;</span>
              <span className="text-text-muted text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary">relationship</span>
            </div>
          </div>
        </div>

        <p>No other memory system can answer: <strong className="text-text-primary">&quot;Prove when this agent learned that fact.&quot;</strong></p>
        <p>Memories can be recalled, forgotten (auditably — the forget itself is receipted), exported as portable bundles, and verified by third parties.</p>
      </Section>

      {/* Section 3: The ModQuote Story */}
      <Section id="modquote-story" title="Real-World Example: ModQuote" icon={Zap}>
        <p>
          <a href="https://modquote.io" className="text-primary hover:underline font-medium" target="_blank" rel="noopener noreferrer">ModQuote</a> is
          a multi-tenant SaaS where AI agents generate quotes for automotive protection shops — PPF, ceramic coatings, window tint.
        </p>

        <div className="card divide-y divide-border/50">
          <div className="px-4 py-3 flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-bg-tertiary flex items-center justify-center text-xs font-bold text-text-muted shrink-0">1</span>
            <div>
              <div className="text-xs font-medium text-text-primary">Customer requests a PPF quote for a Tesla Model 3</div>
              <div className="text-xs text-text-muted mt-0.5">Agent receives vehicle data, shop pricing rules, coverage options</div>
            </div>
          </div>
          <div className="px-4 py-3 flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">2</span>
            <div>
              <div className="text-xs font-medium text-text-primary">Agent generates the quote → <code className="text-primary bg-primary/10 px-1 rounded">track_action</code> creates a signed receipt</div>
              <div className="text-xs text-text-muted mt-0.5">Input hash proves what data was received. Output hash proves the $2,400 price.</div>
            </div>
          </div>
          <div className="px-4 py-3 flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">3</span>
            <div>
              <div className="text-xs font-medium text-text-primary">Agent remembers &quot;prefers full-front coverage&quot; → <code className="text-primary bg-primary/10 px-1 rounded">memory_observe</code></div>
              <div className="text-xs text-text-muted mt-0.5">Memory is receipted — provenance chain links back to this conversation.</div>
            </div>
          </div>
          <div className="px-4 py-3 flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-bg-tertiary flex items-center justify-center text-xs font-bold text-text-muted shrink-0">4</span>
            <div>
              <div className="text-xs font-medium text-text-primary">Next session → <code className="text-primary bg-primary/10 px-1 rounded">memory_context</code> loads the preference</div>
              <div className="text-xs text-text-muted mt-0.5">Agent starts already informed. No re-explaining.</div>
            </div>
          </div>
          <div className="px-4 py-3 flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center text-xs font-bold text-success shrink-0">5</span>
            <div>
              <div className="text-xs font-medium text-text-primary">Customer disputes the price → pull the receipt chain</div>
              <div className="text-xs text-text-muted mt-0.5">Input vehicle data, pricing rules applied, output price, timestamp, Ed25519 signature. Cryptographic proof.</div>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 4: Receipt Chains */}
      <Section id="chains" title="Receipt Chains" icon={Link2}>
        <p>Multi-step workflows are linked together as chains. Each step references the previous via <code className="bg-bg-tertiary px-1 rounded text-xs">parent_receipt_id</code>.</p>
        <div className="card p-4 font-mono text-xs space-y-1">
          <div className="text-text-muted mb-2">Chain: PPF quote pipeline (chain_q1247)</div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-text-muted">Step 1</span>
            <span className="w-36">lookup_vehicle</span>
            <span className="text-success">completed</span>
            <span className="text-text-muted ml-auto">0.3s</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-text-muted">Step 2</span>
            <span className="w-36">calculate_pricing</span>
            <span className="text-success">completed</span>
            <span className="text-text-muted ml-auto">1.2s</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-text-muted">Step 3</span>
            <span className="w-36">generate_quote</span>
            <span className="text-success">completed</span>
            <span className="text-text-muted ml-auto">2.1s</span>
          </div>
          <div className="pt-2 border-t border-border/50 text-text-muted">
            Total: 3.6s &middot; 3 signed receipts &middot; full audit trail
          </div>
        </div>
      </Section>

      {/* Section 5: Quality & Compliance */}
      <Section id="quality" title="Quality & Compliance" icon={Scale}>
        <p><strong className="text-text-primary">Constraints</strong> — enforce rules on every receipt:</p>
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
              <tr><td className="py-2 pr-4 font-mono">output_schema</td><td className="py-2">output validates against JSON Schema</td></tr>
            </tbody>
          </table>
        </div>

        <p><strong className="text-text-primary">AI Judge</strong> — evaluate agent output against rubrics. The evaluation itself is a signed receipt chained to the original action.</p>
        <p><strong className="text-text-primary">Memory Bundles</strong> — export portable, verifiable memory packages with entities, observations, receipts, and checksum integrity.</p>
      </Section>

      {/* Section 6: How It Compares */}
      <Section id="comparison" title="How It Compares">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-text-primary w-28"></th>
                <th className="text-left py-2 pr-4 font-medium text-primary">Agent Receipts</th>
                <th className="text-left py-2 pr-4 font-medium text-text-primary">Mem0</th>
                <th className="text-left py-2 pr-4 font-medium text-text-primary">Langfuse</th>
                <th className="text-left py-2 font-medium text-text-primary">Zep</th>
              </tr>
            </thead>
            <tbody>
              <CompareRow feature="Core" ar="Cryptographic proof" mem0="Memory persistence" langfuse="Observability" zep="Memory + RAG" />
              <CompareRow feature="Signing" ar="Ed25519 every action" mem0="None" langfuse="None" zep="None" />
              <CompareRow feature="Memory" ar="Signed + provable" mem0="Yes (hosted)" langfuse="No" zep="Yes (hosted)" />
              <CompareRow feature="Verification" ar="Offline, by anyone" mem0="No" langfuse="No" zep="No" />
              <CompareRow feature="Infrastructure" ar="Local-first" mem0="Cloud API" langfuse="Cloud/self-host" zep="Cloud API" />
              <CompareRow feature="Audit trail" ar="Tamper-proof chain" mem0="Mutable" langfuse="Mutable logs" zep="Mutable" />
            </tbody>
          </table>
        </div>
        <p className="text-text-muted text-xs mt-2">
          Agent Receipts is not an observability tool. Observability tells you what happened <em>inside</em> your system.
          Receipts prove what happened to anyone <em>outside</em> it.
        </p>
      </Section>

      {/* CTA */}
      <div className="card p-6 text-center space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">Try it yourself</h3>
        <p className="text-sm text-text-secondary">Experience Agent Receipts in 60 seconds — no installation required.</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/walkthrough"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Interactive Demo <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/get-started"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border rounded-lg text-text-primary hover:bg-bg-secondary transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  )
}
