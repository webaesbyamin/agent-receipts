# Agent Receipts

> Observability is internal. Receipts are external.

**Agent Receipts** is an implementation of the **Action Receipt Protocol (ARP)** — an open standard for verifiable, signed, immutable proof of autonomous actions performed by agents, tools, or workflows.

## The Problem

Agents fail silently. There is no standardized way to know if an agent actually did what it said, how well it did it, or whether the output is trustworthy. Existing tools solve developer observability — internal debugging. Nobody is producing a portable, shareable, cryptographically signed proof that an agent performed action X at time Y with result Z.

**Logs are mutable, internal, unverifiable, developer-only.**
**Receipts are signed, immutable, shareable, third-party verifiable.**

This is not observability. This is accountability.

## Quick Start

```bash
npm install @agentreceipts/sdk
```

```typescript
import { AgentReceipts } from '@agentreceipts/sdk'

const ar = new AgentReceipts({
  apiKey: 'ar_live_xxxxxxxxxxxx',
  agent: 'quote-generator-v2',
})

// 3 lines to integrate
const receipt = await ar.track('generate_ppf_quote', {
  input: { vehicle: 'Tesla Model 3', service: 'full-front-ppf' },
  execute: async () => {
    const quote = await generateQuote(params)
    return quote
  },
})

console.log(receipt.verify_url)
// → https://agentreceipts.com/verify/rcpt_8f3k2j4n
```

## Receipt Schema (v0.1)

```json
{
  "receipt_id": "rcpt_8f3k2j4n",
  "chain_id": "chain_x9f2k",
  "receipt_type": "action",
  "agent_id": "quote-generator-v2",
  "action": "generate_ppf_quote",
  "input_hash": "sha256:abc123...",
  "output_hash": "sha256:def456...",
  "status": "completed",
  "signature": "ed25519:...",
  "verify_url": "https://agentreceipts.com/verify/rcpt_8f3k2j4n",
  "timestamp": "2026-02-07T14:32:01.442Z"
}
```

Input and output are hashed client-side with SHA-256. Raw data never leaves your environment. Only hashes are stored.

## Verification

Anyone with a receipt ID can verify it — no authentication required:

```
GET https://agentreceipts.com/api/v1/verify/rcpt_8f3k2j4n
```

The server re-validates the Ed25519 signature against the receipt's deterministic fields and returns:

```json
{
  "verified": true,
  "signature_valid": true,
  "receipt": { ... }
}
```

## Receipt Chains

Receipts can be linked into chains for multi-step workflows:

```typescript
const step1 = await ar.track('decode_vin', {
  input: { vin: '5YJ3E1EA1NF123456' },
  execute: async () => decodeVin(vin),
})

const step2 = await ar.track('generate_quote', {
  input: { vehicle: step1Result },
  execute: async () => generateQuote(vehicle),
  parent: step1.receipt_id, // chains automatically
})

// Both receipts share the same chain_id
// step2.chain_id === step1.chain_id
```

## Architecture

```
Layer 3: Dashboard (SaaS)
  Receipt feed, agent scorecards, chain visualization

Layer 2: Verification API (hosted)
  POST /receipts, GET /verify/:id (public, no auth)

Layer 1: SDK + Schema (open source)
  @agentreceipts/sdk — 3 lines to integrate
  @agentreceipts/schema — Zod + JSON Schema
  @agentreceipts/crypto — Ed25519 signing
```

## Pricing

| Plan | Receipts/mo | Retention | Price |
|------|------------|-----------|-------|
| Free | 1,000 | 7 days | $0 |
| Pro | 25,000 | 30 days | $29/mo |
| Business | 100,000 | 90 days | $99/mo |
| Enterprise | Unlimited | Unlimited | Custom |

## Project Structure

```
agent-receipts/
├── apps/web/            # Next.js 14 — API + Dashboard
├── packages/
│   ├── sdk/             # @agentreceipts/sdk
│   ├── schema/          # @agentreceipts/schema (Zod + JSON Schema)
│   └── crypto/          # @agentreceipts/crypto (Ed25519)
├── supabase/            # Database migrations
├── spec/                # Action Receipt Protocol spec
└── examples/            # Integration examples
```

## Development

```bash
pnpm install
pnpm build
pnpm dev
pnpm test
```

## License

MIT - see [LICENSE](./LICENSE)
