# Agent Receipts — Complete Codebase Audit Report

**Audited:** 2026-04-02
**Version:** 0.2.6 (all published packages)
**Gate Check:** Build succeeds, **376 tests pass** (schema 60, crypto 22, mcp-server 232, sdk 17, cli 45)

---

## 1. Package Map

### @agent-receipts/schema

| Field | Details |
|-------|---------|
| Purpose | Zod schemas and TypeScript types for the Action Receipt Protocol |
| Entry point | `./dist/index.js` (CJS), `./dist/index.mjs` (ESM) |
| Key exports | `ActionReceipt`, `SignablePayload`, `ReceiptStatus`, `ReceiptType`, `Environment`, `ErrorCode`, `ConstraintDefinition`, `ConstraintResult`, `SingleConstraintResult`, `ConstraintDefinitions`, `Rubric`, `RubricCriterion`, `CriterionResult`, `JudgmentResult`, `CreateReceiptInput`, `CompleteReceiptInput`, `VerifyResponse`, `ListReceiptsQuery`, `PaginationMeta`, `ErrorResponse`, `validate`, `formatZodError`, `createErrorResponse` (34 total) |
| Internal dependencies | None (leaf package) |
| External dependencies | `zod` ^3.23.0 (schema validation) |
| Test count | 60 tests across 4 files |
| Bin commands | None |

### @agent-receipts/crypto

| Field | Details |
|-------|---------|
| Purpose | Ed25519 signing, verification, and canonical JSON for receipt payloads |
| Entry point | `./dist/index.js` (CJS), `./dist/index.mjs` (ESM) |
| Key exports | `canonicalize`, `signReceipt`, `verifyReceipt`, `getSignablePayload`, `generateKeyPair`, `getPublicKeyFromPrivate` |
| Internal dependencies | `@agent-receipts/schema` (SignablePayload type) |
| External dependencies | `@noble/ed25519` ^2.1.0 (Ed25519 operations), `@noble/hashes` ^1.7.0 (SHA-512 for Ed25519) |
| Test count | 22 tests across 3 files |
| Bin commands | `generate-keys` -> `./bin/generate-keys.ts` |

### @agent-receipts/mcp-server

| Field | Details |
|-------|---------|
| Purpose | MCP server, receipt engine, storage layer, constraint evaluator, invoice/judge/seed systems |
| Entry point | `./dist/index.cjs` (CJS), `./dist/index.js` (ESM) |
| Key exports | `ReceiptStore`, `KeyManager`, `ConfigManager`, `ReceiptEngine`, `evaluateConstraints`, `hashData`, `generateInvoice`, `formatInvoiceJSON/CSV/Markdown/HTML`, `seedDemoData`, types (`TrackParams`, `CreateParams`, `CompleteParams`, `ReceiptFilter`, `PaginatedResult`, `InvoiceOptions`, `Invoice`) |
| Internal dependencies | `@agent-receipts/schema`, `@agent-receipts/crypto` |
| External dependencies | `@modelcontextprotocol/sdk` ^1.12.0 (MCP protocol), `nanoid` ^5.1.2 (ID generation), `zod` ^3.23.0 |
| Test count | 232 tests across 14 files |
| Bin commands | `agent-receipts-server` -> `./dist/server.js`, `mcp-server` -> `./dist/server.js` |

### @agent-receipts/sdk

| Field | Details |
|-------|---------|
| Purpose | TypeScript SDK wrapping the receipt engine with lazy initialization |
| Entry point | `./dist/index.js` (CJS), `./dist/index.mjs` (ESM) |
| Key exports | `AgentReceipts` class, `AgentReceiptsConfig`, `hashData`, `formatInvoiceJSON/CSV/Markdown/HTML`, re-exports of `TrackParams`, `CreateParams`, `CompleteParams`, `ReceiptFilter`, `PaginatedResult`, `InvoiceOptions`, `Invoice`, `ActionReceipt` |
| Internal dependencies | `@agent-receipts/schema`, `@agent-receipts/crypto`, `@agent-receipts/mcp-server` |
| External dependencies | None (only workspace deps) |
| Test count | 17 tests in 1 file |
| Bin commands | None |

### @agent-receipts/cli

| Field | Details |
|-------|---------|
| Purpose | CLI tool for inspecting, verifying, and managing receipts |
| Entry point | `./dist/index.js` (ESM with shebang) |
| Key exports | None (executable only) |
| Internal dependencies | `@agent-receipts/mcp-server`, `@agent-receipts/crypto` |
| External dependencies | None (only workspace deps + Node built-ins) |
| Test count | 45 tests in 1 file |
| Bin commands | `agent-receipts` -> `./dist/index.js`, `cli` -> `./dist/index.js` |

### @agent-receipts/web (dashboard)

| Field | Details |
|-------|---------|
| Purpose | Next.js 15 local web dashboard for receipt visualization and management |
| Entry point | Next.js app (port 3274) |
| Key exports | None (web app) |
| Internal dependencies | `@agent-receipts/sdk`, `@agent-receipts/crypto`, `@agent-receipts/schema`, `@agent-receipts/mcp-server` |
| External dependencies | `next` ^15.5.0, `react` ^19.0.0, `swr` ^2.3.0, `recharts` ^2.15.0, `lucide-react` ^0.475.0, `clsx`, `tailwind-merge` |
| Test count | 0 (no tests) |
| Bin commands | None |

---

## 2. Complete Data Model

### ActionReceipt — All Fields

| Field | Type | Required | What It Represents | Set When |
|-------|------|----------|-------------------|----------|
| `receipt_id` | `string` | Yes | Unique receipt identifier (`rcpt_<nanoid(12)>`) | Create time |
| `parent_receipt_id` | `string \| null` | Yes (nullable) | Parent receipt for chaining | Create time |
| `chain_id` | `string` | Yes | Chain identifier (`chain_<nanoid(8)>`) | Create time |
| `receipt_type` | `ReceiptType` | Yes | Type of receipt | Create time |
| `agent_id` | `string` | Yes | Agent identifier | Create time (from config or param) |
| `org_id` | `string` | Yes | Organization identifier | Create time (from config) |
| `action` | `string` | Yes | Action name | Create time |
| `input_hash` | `string` | Yes | SHA-256 hash of input (`sha256:<hex>`) | Create time |
| `output_hash` | `string \| null` | Yes (nullable) | SHA-256 hash of output | Create or complete time |
| `output_summary` | `string \| null` | Yes (nullable) | Human-readable output summary | Create or complete time |
| `model` | `string \| null` | Yes (nullable) | LLM model name | Create or complete time |
| `tokens_in` | `number \| null` | Yes (nullable, int, >=0) | Input token count | Create or complete time |
| `tokens_out` | `number \| null` | Yes (nullable, int, >=0) | Output token count | Create or complete time |
| `cost_usd` | `number \| null` | Yes (nullable, >=0) | Execution cost in USD | Create or complete time |
| `latency_ms` | `number \| null` | Yes (nullable, int, >=0) | Execution latency in ms | Create or complete time |
| `tool_calls` | `string[] \| null` | Yes (nullable) | Array of tool call names | Create or complete time |
| `timestamp` | `string` (ISO 8601) | Yes | Creation timestamp | Create time |
| `completed_at` | `string \| null` (ISO 8601) | Yes (nullable) | Completion timestamp | Complete time |
| `status` | `ReceiptStatus` | Yes | Current receipt status | Create time, updated at complete time |
| `error` | `Record<string, unknown> \| null` | Yes (nullable) | Error details if failed | Complete time |
| `environment` | `Environment` | Yes | Deployment environment | Create time (from config or param) |
| `tags` | `string[] \| null` | Yes (nullable) | Arbitrary tags | Create time |
| `constraints` | `Record<string, unknown> \| null` | Yes (nullable) | Constraint definitions | Create time |
| `constraint_result` | `Record<string, unknown> \| null` | Yes (nullable) | Constraint evaluation result | Create or complete time (auto-evaluated) |
| `signature` | `string` | Yes | Ed25519 signature (`ed25519:<base64>`) | Create time, re-signed on complete |
| `verify_url` | `string` (URL) | Yes | URL for verification | Create time |
| `callback_verified` | `boolean \| null` | Yes (nullable) | Whether callback verified | Complete time |
| `confidence` | `number \| null` (0-1) | Yes (nullable) | Confidence score | Create or complete time |
| `metadata` | `Record<string, unknown>` | Yes (default `{}`) | Arbitrary metadata (stores `expires_at`, judgment data, rubric hash) | Create time, merged on complete |

### SignablePayload — 12 Cryptographically Signed Fields

Only these 12 fields are included in the signature:

`action`, `agent_id`, `chain_id`, `completed_at`, `environment`, `input_hash`, `org_id`, `output_hash`, `receipt_id`, `receipt_type`, `status`, `timestamp`

### Enum Values

**`receipt_type`**: `action` | `verification` | `judgment` | `arbitration`

**`status`**: `pending` | `completed` | `failed` | `timeout`

**`environment`**: `production` | `staging` | `test`

> Note: Only 3 environment values are defined. There is no `development` value in the schema.

**`ErrorCode`** (11 values): `UNAUTHORIZED`, `KEY_REVOKED`, `FORBIDDEN`, `RECEIPT_NOT_FOUND`, `CHAIN_NOT_FOUND`, `AGENT_NOT_FOUND`, `RECEIPT_NOT_PENDING`, `RECEIPT_IMMUTABLE`, `RATE_LIMIT_EXCEEDED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`

### Supporting Schemas

#### ConstraintDefinition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` (min 1) | Yes | Constraint type name |
| `value` | `unknown` | Yes | Constraint value (any type) |
| `message` | `string` | No | Custom message |

#### SingleConstraintResult

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Constraint type name |
| `passed` | `boolean` | Yes | Whether constraint passed |
| `expected` | `unknown` | Yes | Expected value |
| `actual` | `unknown` | Yes | Actual value |
| `message` | `string` | No | Result message |

#### ConstraintResult

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `passed` | `boolean` | Yes | Whether all constraints passed |
| `results` | `SingleConstraintResult[]` | Yes | Per-constraint results |
| `evaluated_at` | `string` (ISO 8601) | Yes | Evaluation timestamp |

#### RubricCriterion

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` (min 1) | Yes | Criterion name |
| `description` | `string` (min 1) | Yes | Criterion description |
| `weight` | `number` (0-1) | Yes | Weight |
| `passing_threshold` | `number` (0-1) | No | Threshold |
| `examples` | `{ good?: string[], bad?: string[] }` | No | Good/bad examples |

#### Rubric

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `string` | Yes (default `'1.0'`) | Rubric version |
| `criteria` | `RubricCriterion[]` (min 1) | Yes | Array of criteria |
| `passing_threshold` | `number` (0-1) | Yes (default `0.7`) | Overall threshold |
| `require_all` | `boolean` | Yes (default `false`) | Require all criteria to pass |

#### JudgmentResult

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `verdict` | `'pass' \| 'fail' \| 'partial'` | Yes | Overall verdict |
| `score` | `number` (0-1) | Yes | Overall score |
| `criteria_results` | `CriterionResult[]` | Yes | Per-criterion results |
| `overall_reasoning` | `string` | Yes | Overall explanation |
| `rubric_version` | `string` | Yes | Rubric version used |

#### CriterionResult

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `criterion` | `string` | Yes | Criterion name |
| `score` | `number` (0-1) | Yes | Score |
| `passed` | `boolean` | Yes | Whether passed |
| `reasoning` | `string` | Yes | Explanation |

#### CreateReceiptInput

Required: `agent_id` (min 1), `action` (min 1), `input_hash` (min 1). Defaults: `receipt_type: 'action'`, `status: 'pending'`, `environment: 'production'`. All other receipt fields optional.

#### CompleteReceiptInput

Required: `status` (`'completed' | 'failed' | 'timeout'` — cannot be `'pending'`). All metric fields optional.

#### ListReceiptsQuery

Defaults: `page: 1`, `limit: 50` (max 100), `sort: 'created_at:desc'`. Optional filters: `agent_id`, `action`, `status`, `environment`, `receipt_type`, `chain_id`, `tag`, `from`, `to`.

#### PaginationMeta

Fields: `page`, `limit`, `total`, `total_pages`, `has_next`, `has_prev`.

#### VerifyResponse

Fields: `verified` (boolean), `receipt` (subset of receipt fields — excludes org_id, metadata, tags, output_summary), `signature_valid`, `chain_length`, `public_key_url`.

---

## 3. Receipt Lifecycle

### Step-by-step: `track_action` MCP call

```
Client calls track_action(action, input, output, ...)
  -> tools/track-action.ts handler
    -> engine.track(params)
      1. hashData(input)  -> input_hash (sha256:<hex>)
      2. hashData(output) -> output_hash (sha256:<hex>)
      3. engine.create({ ..., status: 'completed' })
         a. Generate receipt_id = "rcpt_" + nanoid(12)
         b. Generate chain_id = "chain_" + nanoid(8) (if not provided)
         c. Set timestamp = new Date().toISOString()
         d. Set completed_at = timestamp (since status is 'completed')
         e. Load config for agent_id, org_id, environment
         f. Set verify_url from config
         g. Compute expires_at from ttl_ms if provided
         h. Evaluate constraints if present -> constraint_result
         i. Sign the receipt
         j. Validate against ActionReceipt Zod schema
         k. store.save(receipt) -- atomic write
      4. Return signed ActionReceipt
```

### How `input_hash` and `output_hash` are computed

```typescript
// mcp-server/src/hash.ts
function hashData(data: unknown): string {
  const canonical = canonicalStringify(data)  // deep canonical JSON
  const hash = createHash('sha256').update(canonical).digest('hex')
  return `sha256:${hash}`
}
```

`canonicalStringify` performs **deep** canonical JSON: recursively sorts all object keys at every nesting level, handles arrays, nulls, and primitives. This is distinct from the crypto package's flat `canonicalize()` which only sorts the 12 top-level SignablePayload keys.

### What gets signed (the signable payload)

```typescript
// crypto/src/sign.ts -> getSignablePayload()
// Extracts exactly 12 fields:
{
  receipt_id, chain_id, receipt_type, agent_id, org_id, action,
  input_hash, output_hash, status, timestamp, completed_at, environment
}
```

### How the signature is produced

```typescript
// crypto/src/sign.ts -> signReceipt()
1. canonicalize(payload)        // Sort 12 keys alphabetically -> JSON string
2. new TextEncoder().encode()   // UTF-8 bytes
3. ed25519.sign(bytes, privKey) // @noble/ed25519 sign
4. return "ed25519:" + base64(signature)
```

The Ed25519 algorithm internally uses SHA-512 (configured via `etc.sha512Sync` from `@noble/hashes`).

### How `verify_receipt` checks the signature

```typescript
// crypto/src/sign.ts -> verifyReceipt()
1. Check signature starts with "ed25519:"
2. canonicalize(payload)           // Identical canonicalization
3. new TextEncoder().encode()      // Identical encoding
4. base64Decode(signature.slice(8)) // Decode signature
5. ed25519.verify(sigBytes, message, pubKey)  // @noble/ed25519 verify
```

### Where the receipt file lands

```
~/.agent-receipts/receipts/{receipt_id}.json
```

Written atomically via temp file + rename. The data directory can be overridden via `AGENT_RECEIPTS_DATA_DIR` env var.

---

## 4. Storage Layer

### ReceiptStore

- **Persistence:** Individual JSON files, one per receipt, 2-space indented
- **File path pattern:** `{dataDir}/receipts/{receipt_id}.json`
- **Atomic writes:** Write to `.tmp_{randomHex}.json` temp file, then `rename()` (POSIX atomic operation)
- **Filtering:** All in-memory after loading all files from disk. Filterable fields: `agent_id`, `action`, `status`, `environment`, `receipt_type`, `chain_id`, `parent_receipt_id`, `tag`, `from` (timestamp), `to` (timestamp)
- **Pagination:** `page`/`limit` with computed `total_pages`, `has_next`, `has_prev`. Default: page 1, limit 50
- **Sorting:** `"field:direction"` format (e.g., `"timestamp:desc"`). Default: `"timestamp:desc"`. Null values sorted to end.
- **Corrupt files:** Silently skipped during list operations

**Core Methods:**

| Method | Signature | Purpose |
|--------|-----------|---------|
| `init()` | `async void` | Create receipts directory recursively |
| `save(receipt)` | `async void` | Atomic save with temp file + rename |
| `get(receiptId)` | `async ActionReceipt \| null` | Retrieve single receipt by ID |
| `exists(receiptId)` | `async boolean` | Check if receipt exists |
| `list(filter?, page, limit, sort)` | `async PaginatedResult<ActionReceipt>` | List with filtering and pagination |
| `getChain(chainId)` | `async ActionReceipt[]` | Get all receipts for a chain (ordered asc) |
| `count(filter?)` | `async number` | Count receipts matching filter |
| `delete(receiptId)` | `async boolean` | Delete receipt file |
| `cleanup()` | `async {deleted, total}` | Delete expired receipts (checks `metadata.expires_at`) |

### KeyManager

- **Priority order:** (1) `RECEIPT_SIGNING_PRIVATE_KEY` env var -> (2) `{dataDir}/keys/private.key` file -> (3) auto-generate
- **Private key storage:** `{dataDir}/keys/private.key` with mode `0o600` (owner read/write only)
- **Public key storage:** `{dataDir}/keys/public.key` (readable)
- **Public key derivation:** Deterministic via `getPublicKeyFromPrivate()` from `@noble/ed25519`
- **Key format:** 64-character hex strings (32 bytes each, Ed25519)

**Methods:**

| Method | Signature | Purpose |
|--------|-----------|---------|
| `init()` | `async void` | Create keys dir, load or generate keys |
| `getPrivateKey()` | `string` | Return loaded private key (throws if uninitialized) |
| `getPublicKey()` | `string` | Return loaded public key (throws if uninitialized) |

### ConfigManager

| Field | Type | Default | Env Var Override |
|-------|------|---------|-----------------|
| `agentId` | string | `'local-agent'` | `AGENT_RECEIPTS_AGENT_ID` |
| `orgId` | string | `'local-org'` | `AGENT_RECEIPTS_ORG_ID` |
| `environment` | `'production' \| 'staging' \| 'test'` | `'production'` | `AGENT_RECEIPTS_ENVIRONMENT` |

- **Config file:** `{dataDir}/config.json`
- **Data directory:** `AGENT_RECEIPTS_DATA_DIR` or `~/.agent-receipts`
- **Env vars:** Override file values at load time

**Methods:**

| Method | Signature | Purpose |
|--------|-----------|---------|
| `init()` | `async void` | Create dir, load config (file + env) |
| `getConfig()` | `AppConfig` | Return copy of current config |
| `update(partial)` | `async void` | Merge partial config and save |
| `save()` | `async void` | Persist current config to JSON |
| `getDefaultDataDir()` | `static string` | Get data dir from env or homedir |

---

## 5. MCP Tools Reference (14 tools)

### track_action

- **Description:** Create a completed receipt with auto-hashed input/output
- **Parameters:** `action` (string, required), `input` (unknown, required), `output` (unknown, optional), `output_summary` (string), `model` (string), `tokens_in` (number), `tokens_out` (number), `cost_usd` (number), `latency_ms` (number), `tool_calls` (string[]), `tags` (string[]), `confidence` (number 0-1), `metadata` (record), `parent_receipt_id` (string), `chain_id` (string), `constraints` (array), `expires_at` (string), `ttl_ms` (number)
- **Engine method:** `engine.track()`
- **Returns:** Receipt JSON + constraint summary if applicable

### create_receipt

- **Description:** Create receipt with pre-computed hashes
- **Parameters:** `action` (required), `input_hash` (required), `receipt_type`, `output_hash`, `output_summary`, `model`, `tokens_in`, `tokens_out`, `cost_usd`, `latency_ms`, `tool_calls`, `tags`, `confidence`, `metadata`, `parent_receipt_id`, `chain_id`, `status`, `constraints`, `expires_at`, `ttl_ms`
- **Engine method:** `engine.create()`
- **Returns:** Receipt JSON

### complete_receipt

- **Description:** Complete a pending receipt
- **Parameters:** `receipt_id` (required), `status` (required: completed|failed|timeout), `output_hash`, `output_summary`, `model`, `tokens_in`, `tokens_out`, `cost_usd`, `latency_ms`, `tool_calls`, `confidence`, `callback_verified`, `error` (record)
- **Engine method:** `engine.complete()`
- **Returns:** Receipt JSON

### verify_receipt

- **Description:** Verify cryptographic signature
- **Parameters:** `receipt_id` (required)
- **Engine method:** `engine.verify()`
- **Returns:** `{verified, receipt_id, action, status, signature}`

### get_receipt

- **Description:** Retrieve receipt by ID
- **Parameters:** `receipt_id` (required)
- **Engine method:** `engine.get()`
- **Returns:** Receipt JSON or error message

### list_receipts

- **Description:** List/filter receipts with pagination
- **Parameters:** `agent_id`, `action`, `status`, `environment`, `receipt_type`, `chain_id`, `tag`, `page` (int), `limit` (int, max 100), `sort` (string)
- **Engine method:** `engine.list()`
- **Returns:** `{data: receipt[], pagination: {page, limit, total, total_pages, has_next, has_prev}}`

### get_chain

- **Description:** Get all receipts in a chain
- **Parameters:** `chain_id` (required)
- **Engine method:** `engine.getChain()`
- **Returns:** Receipt array sorted by timestamp ascending

### get_public_key

- **Description:** Export Ed25519 public key
- **Parameters:** (none)
- **Engine method:** `engine.getPublicKey()`
- **Returns:** `{algorithm: 'Ed25519', public_key: hex, format: 'hex'}`

### judge_receipt

- **Description:** Start judgment evaluation (creates pending judgment receipt)
- **Parameters:** `receipt_id` (required), `rubric` (object with `version?`, `criteria[]` with name/description/weight/passing_threshold, `passing_threshold?`, `require_all?`), `output_summary_for_review` (string)
- **Engine method:** `engine.get()` + `engine.create()`
- **Returns:** Markdown evaluation prompt with rubric and instructions to call `complete_judgment`

### complete_judgment

- **Description:** Complete a pending judgment
- **Parameters:** `judgment_receipt_id` (required), `verdict` (pass|fail|partial), `score` (0-1), `criteria_results` (array of {criterion, score, reasoning}), `overall_reasoning`, `confidence` (0-1)
- **Engine method:** `engine.get()` + `engine.complete()`
- **Returns:** `{judgment_receipt_id, verdict, score, parent_receipt_id, chain_id}`

### get_judgments

- **Description:** Get all judgments for a receipt
- **Parameters:** `receipt_id` (required)
- **Engine method:** `engine.getJudgments()`
- **Returns:** `{receipt_id, count, judgments: [{judgment_id, verdict, score, status, output_summary, confidence, timestamp, completed_at}]}`

### cleanup

- **Description:** Delete expired receipts
- **Parameters:** `dry_run` (boolean, default false)
- **Engine method:** `engine.cleanup()` or scan-only for dry run
- **Returns:** `{deleted, remaining}` or `{dry_run: true, would_delete, total, expired_receipts: []}`

### generate_invoice

- **Description:** Generate invoice from receipts in date range
- **Parameters:** `from` (ISO date, required), `to` (ISO date, required), `client_name`, `client_email`, `provider_name`, `provider_email`, `group_by` (action|agent|day|none), `format` (json|csv|md), `include_receipts` (boolean), `agent_ids` (string[]), `actions` (string[]), `constraints_passed_only` (boolean), `notes`, `payment_terms`
- **Engine method:** `engine.generateInvoice()`
- **Returns:** Formatted invoice (JSON/CSV/Markdown based on format param)

### get_started

- **Description:** Show getting-started guide
- **Parameters:** (none)
- **Engine method:** (none — returns static content)
- **Returns:** Markdown guide with usage examples for all tools

---

## 6. SDK API Reference

### `AgentReceipts` class

**Constructor:** `new AgentReceipts(config?: { dataDir?: string })`

Lazy-initializes `ReceiptStore`, `KeyManager`, `ConfigManager`, and `ReceiptEngine` on first method call via `ensureInitialized()`.

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `track` | `(params: TrackParams) -> Promise<ActionReceipt>` | Completed receipt | One-shot: auto-hashes input/output, creates completed receipt |
| `emit` | `(params: TrackParams) -> Promise<ActionReceipt>` | Completed receipt | Alias for `track` |
| `start` | `(params: CreateParams) -> Promise<ActionReceipt>` | Pending receipt | Two-phase: creates pending receipt |
| `complete` | `(receiptId: string, params: CompleteParams) -> Promise<ActionReceipt>` | Completed receipt | Two-phase: completes pending receipt |
| `verify` | `(receiptId: string) -> Promise<{verified: boolean; receipt: ActionReceipt}>` | Verification result | Verifies receipt signature |
| `get` | `(receiptId: string) -> Promise<ActionReceipt \| null>` | Receipt or null | Retrieves receipt by ID |
| `list` | `(filter?: ReceiptFilter) -> Promise<PaginatedResult<ActionReceipt>>` | Paginated results | Lists receipts with optional filter |
| `getPublicKey` | `() -> Promise<string>` | Hex string | Returns Ed25519 public key |
| `getJudgments` | `(receiptId: string) -> Promise<ActionReceipt[]>` | Receipt array | Gets judgment receipts for a receipt |
| `cleanup` | `() -> Promise<{deleted: number; remaining: number}>` | Counts | Deletes expired receipts |
| `generateInvoice` | `(options: InvoiceOptions) -> Promise<Invoice>` | Invoice object | Generates invoice for date range |

### Exported Utility Functions

- `hashData(data: unknown): string` — Deep canonical JSON + SHA-256 hashing
- `formatInvoiceJSON(invoice, includeReceipts?): string` — Pretty JSON formatter
- `formatInvoiceCSV(invoice): string` — CSV formatter
- `formatInvoiceMarkdown(invoice): string` — Markdown formatter
- `formatInvoiceHTML(invoice): string` — Full responsive HTML formatter

---

## 7. CLI Commands Reference

### init

- **Flags:** (none)
- **What it does:** Creates data directory (`~/.agent-receipts`) and generates Ed25519 signing keys
- **Method called:** `KeyManager.init()`

### keys

- **Flags:** `--export`, `--import <hex>`
- **What it does:** Display public key (default), export as JSON (`--export`), or import private key from 64-char hex (`--import`)
- **Method called:** `KeyManager.getPublicKey()`, `getPublicKeyFromPrivate()`
- **Notes:** Import validates 64 hex chars, derives public key, writes with `0o600` permissions

### inspect \<id|file\>

- **Flags:** (none)
- **What it does:** Pretty-print receipt details including identity, timestamps, performance, constraints, expiration status
- **Method called:** `engine.get()` or reads JSON file from disk

### verify \<id|file\>

- **Flags:** `--key <hex>` (optional external public key)
- **What it does:** Verify receipt signature. Uses local key by default or `--key` for external verification
- **Method called:** `engine.get()`, `verifyReceipt()` from crypto
- **Notes:** Exits with code 1 if verification fails

### list

- **Flags:** `--agent <id>`, `--status <status>`, `--failed`, `--passed`, `--limit <n>`, `--json`
- **What it does:** List receipts with optional filtering by agent, status, constraint pass/fail
- **Method called:** `engine.list()`

### chain \<chainId\>

- **Flags:** `--tree`
- **What it does:** Show all receipts in a chain as numbered list (default) or parent-child tree (`--tree`)
- **Method called:** `engine.getChain()`

### judgments \<receiptId\>

- **Flags:** `--json`
- **What it does:** Show judgment receipts for a given receipt with verdict, score, criteria details
- **Method called:** `engine.getJudgments()`

### stats

- **Flags:** (none)
- **What it does:** Show aggregate statistics: status breakdown, action counts, constraint pass/fail
- **Method called:** `engine.list()` (loads all receipts)

### export \<id\>

- **Flags:** `--all`, `--pretty`
- **What it does:** Export single receipt or all receipts as JSON
- **Method called:** `engine.get()` or `engine.list()`

### cleanup

- **Flags:** `--dry-run`
- **What it does:** Delete expired receipts or preview what would be deleted
- **Method called:** `engine.cleanup()`

### invoice

- **Flags:** `--from` (required), `--to` (required), `--client`, `--provider`, `--format` (json|csv|md|html), `--output <path>`, `--group-by` (action|agent|day|none), `--agent` (repeatable), `--notes`, `--payment-terms`
- **What it does:** Generate invoice from receipts in date range. HTML writes file, others output to stdout
- **Method called:** `engine.generateInvoice()` + formatters

### seed

- **Flags:** `--demo`, `--clean`, `--count <n>`
- **What it does:** Seed demo data for testing. `--demo` generates receipts, `--clean` clears first, `--count` sets target
- **Method called:** `seedDemoData()`

### watch

- **Flags:** `--agent`, `--action`, `--status`, `--interval <ms>` (default 1000)
- **What it does:** Real-time receipt monitoring via polling with ANSI-colored output
- **Method called:** `engine.list()` with `from` timestamp filter

---

## 8. Dashboard

### Route Structure (Next.js 15 App Router)

**Page Routes (12):**

| Route | Description |
|-------|-------------|
| `/` | Overview dashboard: stats cards, 14-day volume chart, constraint health pie, recent receipts/failures |
| `/agents` | Agent list with total receipts, cost, latency, constraint pass rate per agent |
| `/agents/[id]` | Agent detail: stats, action breakdown table, 14-day chart, recent receipts |
| `/receipts` | Receipt explorer: multi-filter (status, constraints, type, environment, search), sorting, pagination, export |
| `/receipts/[id]` | Receipt detail: identity, timestamps, performance, constraints breakdown, judgments, chain tree, signature verification, raw JSON |
| `/chains` | Chain list: chain_id, receipt count, agents, duration, status, cost (excludes single-receipt chains) |
| `/chains/[id]` | Chain detail: tree visualization, agents involved, total cost/duration, constraint stats |
| `/invoices` | Invoice generation form: date range, client/provider, grouping, filtering, multi-format download |
| `/judgments` | Judgment stats: total, pass rate, avg score, criteria breakdown, recent judgments |
| `/constraints` | Constraint health: type breakdown, failure analysis, 14-day pass rate trend chart |
| `/verify` | Receipt verification: paste JSON or upload file, enter public key or use local, shows verification result |
| `/settings` | Configuration: data dir, public key, agent/org/environment, cleanup, theme, auto-refresh |

**API Routes (12):**

| Route | Method | Purpose | Returns |
|-------|--------|---------|---------|
| `/api/receipts` | GET | List receipts with filters and pagination | `{data, pagination}` |
| `/api/receipts/[id]` | GET | Get receipt + verification + chain + judgments + children | `{receipt, verified, chain?, judgments?, children?}` |
| `/api/agents` | GET | Aggregate agent summaries with metrics | `{agents: AgentSummary[]}` |
| `/api/stats` | GET | Dashboard stats (totals, rates, trends) | Stats object with volume/trend arrays |
| `/api/judgments` | GET | List judgment receipts with optional filters | `{data, pagination}` |
| `/api/chains/[id]` | GET | Chain detail with tree structure | `{chain_id, receipts, agents, tree, stats}` |
| `/api/config` | GET/PUT | Get or update configuration | Config object |
| `/api/verify` | POST | Verify receipt signature | `{verified, public_key_used, receipt_id}` |
| `/api/invoices` | POST | Generate invoice | `{invoice, formatted}` |
| `/api/search` | GET | Global search (min 2 chars) | `{receipts, agents, chains}` |
| `/api/cleanup` | POST | Delete expired receipts | `{deleted, remaining}` |

### How It Connects to the Local Receipt Store

API routes use a lazy-loaded singleton from `lib/sdk-server.ts` that directly instantiates `ReceiptStore`, `KeyManager`, and `ConfigManager` from `@agent-receipts/mcp-server`. Data is read from the local filesystem — no MCP protocol or network calls involved.

### Data Fetching

Client-side data fetching uses **SWR** with auto-refresh (configurable, default 10s interval) and window focus revalidation. Custom hooks: `useReceipts`, `useAgents`, `useStats`, `useAutoRefresh`.

### Component Structure (18 shared components)

`DataTable`, `Pagination`, `StatCard`, `StatusBadge`, `ConstraintBadge`, `TimeAgo`, `LoadingCards/Table/Page`, `ErrorState`, `EmptyState`, `ChartWrapper`, `CopyButton`, `HashDisplay`, `JsonViewer`, `SearchDialog`, `LayoutShell`, `Header`, `Sidebar`, `MobileNav`

---

## 9. Test Coverage Map

### @agent-receipts/schema (60 tests, 4 files)

| File | Tests | Coverage |
|------|-------|---------|
| `receipt.test.ts` | 25 | ActionReceipt, SignablePayload, CreateReceiptInput, CompleteReceiptInput, VerifyResponse, ListReceiptsQuery, ErrorResponse, PaginationMeta |
| `constraints.test.ts` | 16 | ConstraintDefinition, SingleConstraintResult, ConstraintResult, ConstraintDefinitions |
| `rubric.test.ts` | 14 | RubricCriterion, Rubric, CriterionResult, JudgmentResult |
| `validation.test.ts` | 5 | `validate`, `formatZodError`, `createErrorResponse` |

**Gaps:** None significant. All exported schemas tested.

### @agent-receipts/crypto (22 tests, 3 files)

| File | Tests | Coverage |
|------|-------|---------|
| `sign.test.ts` | 11 | `signReceipt`, `verifyReceipt`, `getSignablePayload` — round-trip, tampering, format, determinism |
| `canonical.test.ts` | 6 | `canonicalize` — key ordering, null handling, field count, JSON validity |
| `keys.test.ts` | 5 | `generateKeyPair`, `getPublicKeyFromPrivate` — hex format, lengths, derivation |

**Gaps:** None. All exported functions tested.

### @agent-receipts/mcp-server (232 tests, 14 files)

| File | Tests | Coverage |
|------|-------|---------|
| `receipt-engine.test.ts` | 37 | Engine: create, complete, track, verify, list, getChain, getJudgments, constraints, signatures |
| `invoice.test.ts` | 34 | Invoice generation: date ranges, grouping, filters, all 4 formatters |
| `constraint-evaluator.test.ts` | 28 | All 6 constraint types, null handling, unknown types |
| `json-schema-validator.test.ts` | 22 | JSON Schema: all types, required, properties, nested, arrays, enum, pattern |
| `receipt-store.test.ts` | 17 | Store: save/get, exists, list, filters, pagination, getChain, delete, cleanup |
| `tools.test.ts` | 16 | MCP tool registration and flow: track_action, create+complete, list, verify |
| `seed.test.ts` | 15 | Demo data: count range, agents, chains, constraints, expired/future |
| `hash.test.ts` | 14 | `hashData`: format, determinism, deep objects, arrays, null, key ordering |
| `judge.test.ts` | 14 | Judge system: create pending, complete, store result, getJudgments, end-to-end |
| `config-manager.test.ts` | 10 | Config: defaults, persistence, all env var overrides |
| `output-schema-constraint.test.ts` | 8 | output_schema constraint: valid/invalid, required fields, nested, arrays |
| `cleanup.test.ts` | 8 | TTL: ttl_ms to expires_at, cleanup expired, keep non-expired, empty store |
| `key-manager.test.ts` | 6 | Keys: auto-generate, persistence, env var priority, permissions |
| `get-started.test.ts` | 3 | get_started tool: returns markdown, includes tool names |

**Gaps:** MCP server wire protocol (`server.ts`) not integration-tested. Invoice HTML formatter tested for content presence only, not rendering fidelity.

### @agent-receipts/sdk (17 tests, 1 file)

| File | Tests | Coverage |
|------|-------|---------|
| `client.test.ts` | 17 | track, emit alias, start+complete, verify, get, list, filter, publicKey, chaining, constraints, judgments, cleanup, expires_at, generateInvoice (x2) |

**Gaps:** None significant for the thin wrapper.

### @agent-receipts/cli (45 tests, 1 file)

| File | Tests | Coverage |
|------|-------|---------|
| `cli.test.ts` | 45 | All 13 commands: init (1), keys (5), inspect (4), verify (3), list (3), chain (2), export (3), stats (2), judgments (3), cleanup (4), invoice (8), seed (2), watch (1) |

**Gaps:** `watch` command only tests help output (not actual polling behavior). No test validates `--version` returns correct version.

### @agent-receipts/web (0 tests)

**Gaps:** No test coverage at all. No unit, integration, or e2e tests for the Next.js application.

---

## 10. Dependency Graph

```
@agent-receipts/schema
         |
         v
@agent-receipts/crypto
         |
         v
@agent-receipts/mcp-server
         |
   ------+------------------
   |          |             |
   v          v             v
  sdk        cli        dashboard (apps/web)
   |                        |
   +------------------------+
   (dashboard also imports schema, crypto, mcp-server directly)
```

### Cross-Package Symbol Imports

**crypto <-- schema:**
- `SignablePayload` (type)

**mcp-server <-- schema:**
- `ActionReceipt`, `SignablePayload`, `ReceiptStatus`, `ReceiptType`, `Environment`
- `ConstraintDefinition`, `ConstraintResult`, `SingleConstraintResult`, `ConstraintDefinitions`
- `Rubric`, `RubricCriterion`, `CriterionResult`, `JudgmentResult`
- `CreateReceiptInput`, `CompleteReceiptInput`, `ListReceiptsQuery`, `PaginationMeta`
- `validate`

**mcp-server <-- crypto:**
- `signReceipt`, `verifyReceipt`, `getSignablePayload`
- `generateKeyPair`, `getPublicKeyFromPrivate`

**sdk <-- mcp-server:**
- `ReceiptStore`, `KeyManager`, `ConfigManager`, `ReceiptEngine`
- `hashData`, `formatInvoiceJSON`, `formatInvoiceCSV`, `formatInvoiceMarkdown`, `formatInvoiceHTML`
- Types: `TrackParams`, `CreateParams`, `CompleteParams`, `ReceiptFilter`, `PaginatedResult`, `InvoiceOptions`, `Invoice`

**sdk <-- schema:**
- `ActionReceipt` (type re-export)

**cli <-- mcp-server:**
- `ReceiptStore`, `KeyManager`, `ConfigManager`, `ReceiptEngine`
- `formatInvoiceJSON`, `formatInvoiceCSV`, `formatInvoiceMarkdown`, `formatInvoiceHTML`
- `seedDemoData`

**cli <-- crypto:**
- `verifyReceipt`, `getSignablePayload`, `getPublicKeyFromPrivate`

**dashboard <-- mcp-server:**
- `ReceiptStore`, `KeyManager`, `ConfigManager`, `ReceiptEngine` (server-side)
- `formatInvoiceJSON`, `formatInvoiceCSV`, `formatInvoiceMarkdown`, `formatInvoiceHTML`

**dashboard <-- crypto:**
- `verifyReceipt`, `getSignablePayload` (verify API route)

**dashboard <-- schema:**
- `ActionReceipt` (type)

---

## 11. Known Issues / Gaps

### Version Issues

- **CLI version hardcoded as `'0.1.0'`** — `packages/cli/src/index.ts:700` outputs `console.log('0.1.0')` but `package.json` is `0.2.6`. The `--version` flag reports the wrong version.
- **Dashboard version is `0.1.0`** — `apps/web/package.json` has version `0.1.0` while all 6 published packages are `0.2.6`. This is a private package so it doesn't affect npm, but is inconsistent.
- **All 6 published packages are consistently at `0.2.6`.** No version mismatches.

### Schema Gaps

- **No `development` environment value** — The schema defines `Environment = z.enum(['production', 'staging', 'test'])` with only 3 values. No `development` value exists despite it being commonly expected.

### Test Gaps

- **Dashboard has zero test coverage** — No unit, integration, or e2e tests for the Next.js application.
- **CLI `watch` command** — Only tested for presence in help output, not actual polling behavior.
- **CLI `--version`** — No test validates it returns the correct version number.
- **MCP server transport** — The `server.ts` stdio entry point is not directly tested.

### Performance Concerns

- **ReceiptStore filtering is fully in-memory** — All receipts are loaded from disk and filtered in memory on every query. No indexing. Will not scale beyond thousands of receipts without significant latency.
- **Agent detail page loads all receipts** — `apps/web/app/agents/[id]/page.tsx` fetches with `limit: 100000` to compute aggregates in memory.
- **Chain tree building is O(n^2)** — Could be optimized for large chains.

### Code Quality

- **Zero TODOs/FIXMEs** — No `TODO`, `FIXME`, `HACK`, or `BUG` comments found across the entire codebase (clean).
- **No unused exports found.**
- **No npm resolution issues** — All workspace dependencies use `workspace:*`.

---

## 12. Extension Points

### Adding a new MCP tool

1. Create `packages/mcp-server/src/tools/my-tool.ts` with a handler function
2. Register in `packages/mcp-server/src/tools/index.ts` following the existing pattern: add to `server.setRequestHandler` with tool name, description, input schema (Zod), and handler function
3. Export from `packages/mcp-server/src/index.ts` if the handler should be available to other packages
4. Add tests in `packages/mcp-server/src/__tests__/`

### Adding a new receipt type

1. Add the value to `ReceiptType` enum in `packages/schema/src/enums.ts`: change `z.enum(['action', 'verification', 'judgment', 'arbitration'])` to include the new type
2. No other code changes needed — the type flows through the entire system via Zod inference and TypeScript types

### Adding a new CLI command

1. Add a `cmdNewCommand()` function in `packages/cli/src/index.ts`
2. Add a `case 'new-command':` in the `main()` switch statement (~line 720)
3. Update the help text string to include the new command
4. Add tests in `packages/cli/src/__tests__/cli.test.ts`

### Adding a new engine method

1. Add the method to `ReceiptEngine` in `packages/mcp-server/src/engine/receipt-engine.ts`
2. Export any new types from `packages/mcp-server/src/index.ts`
3. Add a wrapper method to `AgentReceipts` class in `packages/sdk/src/index.ts`
4. Re-export any new types from the SDK's `index.ts`

### Adding a new receipt field

1. Add field to `ActionReceipt` schema in `packages/schema/src/receipt.ts`
2. If it should be signed: add to `SignablePayload` in the same file and update `getSignablePayload()` in `packages/crypto/src/sign.ts`
3. If it should be in create input: add to `CreateReceiptInput` in `packages/schema/src/api.ts`
4. Update `engine.create()` in `packages/mcp-server/src/engine/receipt-engine.ts` to populate the field
5. For dashboard display: edit `apps/web/app/receipts/[id]/page.tsx` for the detail view
6. For dashboard filtering: add to the API route handler in `apps/web/app/api/receipts/route.ts`

### Adding a new constraint type

1. Add a new case in `evaluateConstraints()` in `packages/mcp-server/src/engine/constraint-evaluator.ts`
2. Define the evaluation logic: compare `constraint.value` against the relevant receipt field or context
3. Return a `SingleConstraintResult` with `type`, `passed`, `expected`, `actual`
4. Add tests in `packages/mcp-server/src/__tests__/constraint-evaluator.test.ts`

---

## Constraint System Detail

### Supported Constraint Types (6)

| Type | Value Type | Passes If | Null Handling |
|------|-----------|-----------|---------------|
| `max_latency_ms` | number | `receipt.latency_ms <= value` | Fails if null |
| `max_cost_usd` | number | `receipt.cost_usd <= value` | Fails if null |
| `min_confidence` | number | `receipt.confidence >= value` | Fails if null |
| `required_fields` | string[] | All named fields are non-null | Fails if any listed field is null or unknown |
| `status_must_be` | string or string[] | `receipt.status` is in allowed values | N/A |
| `output_schema` | JSON Schema object | Raw output validates against schema | Fails if raw output undefined |

### Evaluation Behavior

- All constraints are evaluated (no short-circuit on first failure)
- Empty constraint array results in `passed: true`
- Unknown constraint type fails with "Unknown constraint type" message
- Custom messages from constraint definitions are passed through to results

---

## Invoice System Detail

### Invoice Structure

```
Invoice {
  invoice_number: "AR-YYYYMMDD-XXXX" (4 random alphanumeric)
  generated_at: ISO string
  period: { from, to }
  client?: { name, email?, address? }
  provider?: { name, email?, address? }
  groups: InvoiceGroup[]
  summary: InvoiceSummary
  public_key: string
  notes?: string
  payment_terms?: string
}
```

### Grouping

- `'none'`: Single group "All Items"
- `'action'`: Group by action name
- `'agent'`: Group by agent_id
- `'day'`: Group by timestamp date (YYYY-MM-DD)
- Groups sorted alphabetically

### Output Formats

- **JSON:** Pretty-printed, optional full receipt inclusion
- **CSV:** Header + data rows + summary comments, proper escaping
- **Markdown:** Tables, summary section, verification info
- **HTML:** Full responsive page with CSS, print-optimized

---

## Seed/Demo System Detail

### Demo Data Pools

- **Agents:** agent-alpha, agent-beta, agent-gamma, agent-delta
- **Actions:** code_review, generate_code, analyze_data, summarize_text, translate, classify_intent, extract_entities, search_docs, validate_input, optimize_query, draft_email, parse_json, run_tests, deploy_service, monitor_health, audit_logs
- **Models:** claude-sonnet-4-20250514, claude-haiku-4-5-20251001, gpt-4o, gpt-4o-mini, gemini-2.0-flash

### Seeding Phases

1. **Standalone receipts** (~40% with constraints, recent timestamps with burst)
2. **Chains** (8-12 chains, 3-7 steps each, parent-child relationships)
3. **Judgments** (0-4 judgment receipts, random verdict distribution)
4. **Expired receipts** (1-3 with past expiration, testable via cleanup)
5. **Future-expiring receipts** (1-5 with future expiration)

---

## Summary Assessment

This is a **well-architected, production-quality monorepo** implementing a complete cryptographic receipt system for AI agent actions. The code is clean (zero TODOs/FIXMEs), consistently structured, and thoroughly tested with 376 tests all passing. The dependency graph is clean with clear layering from schema to crypto to engine to sdk/cli/dashboard.

**Key Strengths:**

- Atomic file writes for data integrity
- Ed25519 cryptographic signing with deterministic canonicalization
- Comprehensive constraint system (6 types including JSON Schema validation)
- Two-phase receipt workflow (pending -> completed)
- Built-in invoice generation with 4 output formats
- AI judgment/rubric evaluation system
- Polished Next.js dashboard with SWR real-time updates
- Custom JSON Schema validator with zero external dependencies
- Consistent package versioning and clean workspace dependency management

**The single most important thing to address next:** The file-based ReceiptStore performs all filtering in memory after loading every receipt from disk. This is fine for local/developer use (hundreds of receipts), but will become a bottleneck as receipt volume grows. Adding an index file, SQLite backend, or even a simple in-memory cache with file-watching would significantly extend the useful lifetime of the local-first architecture.

**Secondary priorities:**

1. Fix the hardcoded CLI version (`0.1.0` should be `0.2.6`)
2. Add dashboard tests (currently zero coverage)
3. Consider adding `development` to the Environment enum
4. Address the `limit: 100000` in the agent detail page
