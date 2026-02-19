# Agent Receipts — Full Repository Audit Report

**Date:** 2026-02-18
**Auditor:** Claude Code (automated)
**Commit:** `8722667` (`feat: initial project structure — Phase 0`)
**Branch:** `main`

---

## 1. Executive Summary

- **Current phase status:** Phase 0 (Repo Foundation) is **complete**. Phases 1–6 are **not started**.
- **Overall health score:** **35 / 100**
  - Phase 0 is exceptionally well-executed (configs, DB schema, spec, documentation), but the repository contains **zero functional application code** — all source files are empty placeholders.
- **Critical issues:** 0 (nothing is broken — there's just nothing built yet)
- **Blocking issues:** 3 (tests fail due to no test files; packages export nothing; web app has no source directory)

---

## 2. Phase Completion Matrix

| Phase | Status | Completion % | Blocking Issues |
|-------|--------|-------------|-----------------|
| Phase 0 — Repo Foundation | **Complete** | 95% | Missing `next.config.ts`, `tailwind.config.ts`, `postcss.config.js` for web app |
| Phase 1 — Schema & Crypto | Not Started | 0% | `packages/schema/src/index.ts` and `packages/crypto/src/index.ts` are empty placeholders |
| Phase 2 — Core API | Not Started | 0% | `apps/web/src/` directory does not exist — no API routes |
| Phase 3 — SDK | Not Started | 0% | `packages/sdk/src/index.ts` is an empty placeholder |
| Phase 4 — Public Pages | Not Started | 0% | No page files exist |
| Phase 5 — Dashboard & Auth | Not Started | 0% | No dashboard or auth code |
| Phase 6 — Constraints | Not Started | 0% | DB columns exist (`constraints`, `constraint_result`), but no logic |

---

## 3. What's Built and Working

### Root Configuration (all correct)
- `package.json` — proper monorepo root with turbo scripts, `node >= 20`, `pnpm@9.15.4`
- `pnpm-workspace.yaml` — includes `apps/*`, `packages/*`, `examples/*`
- `turbo.json` — correct task dependencies (`build` → `^build`, `test` → `build`)
- `tsconfig.base.json` — **strict mode enabled**, `noUncheckedIndexedAccess: true`, ES2022 target, bundler module resolution
- `.gitignore` — comprehensive (`.env*`, `node_modules/`, `dist/`, `.next/`, `.turbo/`, IDE files, OS files, `coverage/`, Supabase local files)
- `.env.example` — lists all 6 required variables with empty values, no hardcoded secrets
- `LICENSE` — MIT, Copyright 2026 Webaes
- `README.md` — thorough documentation (problem statement, quick start, schema, verification, chains, architecture, pricing, project structure)
- `CONTRIBUTING.md` — prerequisites, setup, branch naming, commit format, PR process, implementation rules

### Workspace Configurations (all correct)
- `packages/schema/package.json` — correct exports (`cjs`, `esm`, `types`), dependencies (`zod ^3.23.0`), devDeps (`tsup`, `typescript`, `vitest`)
- `packages/crypto/package.json` — correct exports, `@noble/ed25519 ^2.1.0`, `bin` field for `generate-keys`
- `packages/sdk/package.json` — correct exports, workspace dependency on `@agent-receipts/schema`
- `apps/web/package.json` — workspace deps on `@agent-receipts/schema` + `@agent-receipts/crypto`, Next.js 14, React 18, Supabase JS + SSR, Tailwind CSS
- All `tsconfig.json` files correctly extend `../../tsconfig.base.json`
- All `tsup.config.ts` files correctly configured (`cjs` + `esm`, `dts: true`, `clean: true`, `sourcemap: true`)

### Build System
- `pnpm install` — **succeeds** (all dependencies resolved, lock file up to date)
- `pnpm build` — **succeeds** for all 4 workspaces (schema, crypto, sdk, web)
  - Packages produce `dist/index.js` (CJS), `dist/index.mjs` (ESM), `dist/index.d.ts`, `dist/index.d.mts`
  - Web app builds via Next.js 14 (static 404 page only — no actual pages exist)
- TypeScript type checking — **passes with zero errors** for all packages

### Database Schema (`supabase/migrations/00001_initial_schema.sql`)
- **Fully implemented and production-quality**
- 4 tables: `orgs`, `api_keys`, `agents`, `receipts`
- `nanoid()` function using `gen_random_bytes` from `pgcrypto` (cryptographically secure)
- `receipts` table includes ALL blueprint fields:
  - Core: `id`, `parent_receipt_id`, `chain_id`, `receipt_type`, `agent_id`, `org_id`, `action`, `input_hash`, `output_hash`, `output_summary`, `status`, `error`
  - Metadata: `model`, `tokens_in`, `tokens_out`, `cost_usd`, `latency_ms`, `tool_calls`, `environment`, `tags`, `confidence`, `callback_verified`, `metadata`
  - Verification: `constraints` (JSONB), `constraint_result` (JSONB) — columns exist for Phase 6
  - Trust: `signature` (NOT NULL)
  - Timestamps: `created_at`, `completed_at`, `expires_at`
- `receipt_type` CHECK constraint: `action | verification | judgment | arbitration`
- `environment` CHECK constraint: `production | staging | test`
- `status` CHECK constraint: `pending | completed | failed | timeout`
- 10 indexes including GIN index on `tags`, partial indexes on `status` and `expires_at`
- RLS enabled on all 4 tables
- Service role policies on all tables
- Public read policy on `receipts` (for verify endpoint)
- `enforce_receipt_immutability()` trigger — prevents modification of completed receipts, prevents changing identity fields during completion
- `prevent_receipt_delete()` trigger — blocks all DELETE operations
- `increment_receipt_count()` trigger — auto-increments org receipt count
- `upsert_agent_on_receipt()` trigger — auto-upserts agent with running average stats
- `update_updated_at()` trigger — auto-updates `orgs.updated_at`
- Retention cleanup function documented (commented out, ready for `pg_cron`)
- `api_keys.key_hash` is a **UNIQUE index** (correct)

### Protocol Spec (`spec/v0.1/ACTION-RECEIPT-PROTOCOL.md`)
- **Complete and well-written**
- Includes manifesto with 5 core principles
- Full receipt schema (16 core fields + 10 metadata fields)
- Signing specification: Ed25519, 12 signed fields listed, canonical JSON, re-signing on completion
- Verification specification: public endpoint, 5-step process, public key discovery at `/.well-known/receipt-public-key.json`
- Verification spectrum: 5 tiers (Deterministic → Human Arbitration)
- Receipt chains documented

### Examples Directory (skeleton only)
- `examples/basic/` — exists with `package.json` and placeholder `index.ts`
- `examples/chained/` — exists with `package.json` and placeholder `index.ts`
- `examples/modquote/` — exists with `package.json` and placeholder `index.ts`
- All have correct workspace dependencies on `@agent-receipts/sdk`

### Git History
- Single commit: `8722667 feat: initial project structure — Phase 0`
- Follows commit format convention (`feat: [description] — Phase [N]`)
- Clean working tree, up to date with `origin/main`
- No uncommitted changes

---

## 4. What's Built but Broken

### Tests Fail (exit code 1)
- `@agent-receipts/crypto:test` — **fails**: "No test files found, exiting with code 1"
- `@agent-receipts/sdk:test` — **fails**: "No test files found, exiting with code 1"
- `@agent-receipts/schema:test` — appears to exit similarly (vitest finds no test files)
- **Root cause:** Test scripts (`vitest run`) are configured in `package.json` but zero test files exist in any package.
- **Impact:** `pnpm test` fails for the entire monorepo.

### Package Exports Are Empty
- `packages/schema/src/index.ts` — contains only `export {}` (empty export)
- `packages/crypto/src/index.ts` — contains only `export {}` (empty export)
- `packages/sdk/src/index.ts` — contains only `export {}` (empty export)
- Build succeeds but produces empty output (dist files contain no useful code)
- **Impact:** Any consumer importing from these packages gets nothing.

### Key Generation CLI Is a Stub
- `packages/crypto/bin/generate-keys.ts` — only prints a placeholder message
- **Impact:** Cannot generate Ed25519 key pairs for receipt signing.

### Next.js Web App Has No Source
- `apps/web/src/` directory does not exist
- No `next.config.ts`, `tailwind.config.ts`, or `postcss.config.js`
- Next.js build succeeds but produces only a 404 page (no actual routes)
- **Impact:** No API, no dashboard, no pages.

---

## 5. What's Missing

### Phase 1 — Schema & Crypto (entire phase)
- [ ] `ActionReceipt` Zod schema with all fields
- [ ] `SignablePayload` Zod schema (12 signed fields only)
- [ ] `CreateReceiptInput` Zod schema (required/optional fields for creation)
- [ ] `CompleteReceiptInput` Zod schema (completion payload)
- [ ] `VerifyResponse` Zod schema
- [ ] `ListReceiptsQuery` Zod schema (pagination, filtering)
- [ ] `ErrorResponse` Zod schema with error code enum
- [ ] `PaginationMeta` Zod schema
- [ ] `receipt.schema.json` — JSON Schema file
- [ ] Type exports from schema package
- [ ] `signReceipt()` function using Ed25519 from `@noble/ed25519`
- [ ] `verifyReceipt()` function
- [ ] `getSignablePayload()` function (extract 12 signed fields)
- [ ] Canonical JSON serialization (sorted keys, deterministic)
- [ ] Key generation CLI implementation
- [ ] Tests for crypto (sign/verify round-trip, tamper detection, canonical JSON)
- [ ] Tests for schema (validation pass/fail)

### Phase 2 — Core API (entire phase)
- [ ] `apps/web/src/` directory structure
- [ ] `next.config.ts`
- [ ] `tailwind.config.ts` + `postcss.config.js`
- [ ] Supabase client setup (`apps/web/src/lib/supabase/`)
- [ ] API key auth middleware (`apps/web/src/lib/auth/api-key.ts`)
- [ ] Error handling utilities (`apps/web/src/lib/errors.ts`)
- [ ] Receipt business logic (`apps/web/src/lib/receipts/`)
- [ ] `POST /api/v1/receipts` — create receipt
- [ ] `PATCH /api/v1/receipts/[id]/complete` — complete pending receipt
- [ ] `GET /api/v1/receipts/[id]` — get single receipt
- [ ] `GET /api/v1/receipts` — list receipts (paginated)
- [ ] `GET /api/v1/verify/[id]` — public verification (NO auth)
- [ ] `GET /api/v1/chains/[chainId]` — get chain
- [ ] `GET /api/v1/agents` — list agents
- [ ] `GET /api/v1/agents/[id]` — get agent
- [ ] `GET /api/v1/stats` — org statistics
- [ ] `POST /api/v1/keys` — create API key
- [ ] `GET /api/v1/keys` — list API keys
- [ ] `DELETE /api/v1/keys/[id]` — revoke API key
- [ ] `GET /.well-known/receipt-public-key.json` — public key discovery
- [ ] `GET /api/v1/health` — health check

### Phase 3 — SDK (entire phase)
- [ ] `AgentReceipts` class with constructor config
- [ ] `track()` method (wrap action, auto-hash, single API call)
- [ ] `start()` method (create pending receipt)
- [ ] `complete()` method (complete pending receipt)
- [ ] `emit()` method (fire-and-forget)
- [ ] `verify()` method
- [ ] Client-side SHA-256 hashing with DEEP canonical sorting (recursive)
- [ ] `canonicalize()` function (handles nested objects/arrays)
- [ ] Error classes (`AgentReceiptsError`, `RateLimitError`, etc.)
- [ ] Retry logic with exponential backoff
- [ ] SDK tests (hashing, retry, client methods)
- [ ] Working examples (`basic/`, `chained/`, `modquote/`)

### Phase 4 — Public Pages (entire phase)
- [ ] Landing page (`/`)
- [ ] Live demo (`/live`)
- [ ] Verify page (`/verify/[id]`)

### Phase 5 — Dashboard & Auth (entire phase)
- [ ] Dashboard overview (`/dashboard`)
- [ ] Receipt feed (`/receipts`)
- [ ] Agent scorecards (`/agents`)
- [ ] Chain visualization (`/chains`)
- [ ] Settings (`/settings`)

### Phase 6 — Constraints (entire phase)
- [ ] Constraint validation logic
- [ ] Constraint result population

---

## 6. Critical Issues (must fix before proceeding)

### P1-1: Tests fail — no test files exist
- **What's wrong:** `pnpm test` exits with code 1 because vitest finds no test files in `packages/crypto`, `packages/sdk`, or `packages/schema`.
- **Where:** `packages/*/` (all three packages)
- **Fix:** Either (a) create placeholder test files (e.g., `src/__tests__/index.test.ts` with a trivial passing test) in each package, or (b) remove the `test` script from `package.json` until tests are written in Phase 1/3. Option (a) is preferred — it keeps the test infrastructure ready.
- **Priority:** P1 (blocks CI and `pnpm test`)

### P1-2: Web app missing `next.config.ts` and Tailwind configs
- **What's wrong:** `apps/web/` has `package.json` and `tsconfig.json` but no `next.config.ts`, `tailwind.config.ts`, or `postcss.config.js`. Next.js auto-generates defaults but Tailwind won't work without configuration.
- **Where:** `apps/web/`
- **Fix:** Create `next.config.ts` (minimal, with `transpilePackages` for workspace packages), `tailwind.config.ts`, and `postcss.config.js`.
- **Priority:** P1 (blocks Phase 2 — web app development)

### P1-3: Web app missing `src/` directory
- **What's wrong:** `apps/web/src/` does not exist. There are no pages, API routes, components, or lib files.
- **Where:** `apps/web/`
- **Fix:** Create the standard Next.js 14 App Router directory structure: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, etc.
- **Priority:** P1 (blocks Phase 2 — all API routes and pages)

---

## 7. Schema Compliance Check

### Database Schema vs Blueprint

| Field | In DB? | Type Correct? | Notes |
|-------|--------|---------------|-------|
| `receipt_id` (as `id`) | Yes | `TEXT PRIMARY KEY DEFAULT 'rcpt_' \|\| nanoid()` | Correct — cryptographically random |
| `parent_receipt_id` | Yes | `TEXT REFERENCES receipts(id)` | Correct — nullable FK |
| `chain_id` | Yes | `TEXT NOT NULL` | Correct |
| `receipt_type` | Yes | `TEXT NOT NULL DEFAULT 'action' CHECK(...)` | Correct — 4 values |
| `agent_id` | Yes | `TEXT NOT NULL` | Correct |
| `org_id` | Yes | `TEXT NOT NULL REFERENCES orgs(id)` | Correct — FK to orgs |
| `action` | Yes | `TEXT NOT NULL` | Correct |
| `input_hash` | Yes | `TEXT NOT NULL` | Correct |
| `output_hash` | Yes | `TEXT` | Correct — nullable |
| `output_summary` | Yes | `TEXT` | Correct — nullable, not signed |
| `status` | Yes | `TEXT NOT NULL DEFAULT 'pending' CHECK(...)` | Correct — 4 values |
| `error` | Yes | `JSONB` | Correct — nullable |
| `model` | Yes | `TEXT` | Correct |
| `tokens_in` | Yes | `INTEGER` | Correct |
| `tokens_out` | Yes | `INTEGER` | Correct |
| `cost_usd` | Yes | `NUMERIC(10, 6)` | Correct |
| `latency_ms` | Yes | `INTEGER` | Correct |
| `tool_calls` | Yes | `TEXT[]` | Correct — array |
| `environment` | Yes | `TEXT NOT NULL DEFAULT 'production' CHECK(...)` | Correct — 3 values |
| `tags` | Yes | `TEXT[]` | Correct — array with GIN index |
| `confidence` | Yes | `NUMERIC(3, 2)` | Correct — 0.00 to 1.00 |
| `callback_verified` | Yes | `BOOLEAN` | Correct |
| `metadata` | Yes | `JSONB DEFAULT '{}'` | Correct |
| `constraints` | Yes | `JSONB` | Correct — nullable, Phase 6 |
| `constraint_result` | Yes | `JSONB` | Correct — nullable, Phase 6 |
| `signature` | Yes | `TEXT NOT NULL` | Correct |
| `created_at` | Yes | `TIMESTAMPTZ NOT NULL DEFAULT now()` | Correct |
| `completed_at` | Yes | `TIMESTAMPTZ` | Correct — nullable |
| `expires_at` | Yes | `TIMESTAMPTZ` | Correct — nullable |
| `verify_url` | **No** | — | Not in DB — likely computed at API layer (correct approach) |

### Zod Schemas vs Blueprint

**N/A** — No Zod schemas exist. `packages/schema/src/index.ts` is empty. All schemas listed in the audit prompt (ActionReceipt, SignablePayload, CreateReceiptInput, CompleteReceiptInput, VerifyResponse, ListReceiptsQuery, ErrorResponse, PaginationMeta) are **missing**.

### Signed Fields (from spec)

The spec defines 12 signed fields:
```
receipt_id, chain_id, receipt_type, agent_id, org_id, action,
input_hash, output_hash, status, timestamp, completed_at, environment
```

**Note:** The DB uses `created_at` while the spec says `timestamp`. These must be mapped correctly when implementing the crypto package. The `getSignablePayload()` function should use `created_at` as `timestamp`.

---

## 8. Security Check

- [x] **No hardcoded secrets** — `.env.example` has empty values only; no secrets in any source file
- [x] **`.env` files in `.gitignore`** — `.env`, `.env.local`, `.env.*.local` all ignored; `!.env.example` correctly kept
- [x] **API keys hashed (not stored raw)** — DB schema stores `key_hash` (SHA-256), with `key_prefix` for display; unique index on `key_hash`
- [x] **Receipt IDs cryptographically random** — `nanoid()` uses `gen_random_bytes` from pgcrypto (not `Math.random()`)
- [x] **Verify endpoint has no auth** — RLS policy `public_read_receipts` allows `SELECT` with `USING (true)` (correct)
- [x] **Immutability triggers in place** — `enforce_receipt_immutability` and `prevent_receipt_delete` both exist and are correct
- [x] **No `any` types** — zero instances of `: any` in any source file (packages or apps)
- [x] **No `@ts-ignore` or `@ts-expect-error`** — none found
- [x] **Strict TypeScript** — `strict: true` and `noUncheckedIndexedAccess: true` in base config

### Dependency Vulnerabilities (from `pnpm audit`)

| Severity | Package | Issue | Patched In |
|----------|---------|-------|------------|
| **High** | `next@14.2.35` | HTTP request deserialization DoS (GHSA-h25m-26qc-wcjf) | `>= 15.0.8` |
| Moderate | `esbuild@0.21.5` | Dev server request leakage (GHSA-67mh-4wv8-2f99) | `>= 0.25.0` |
| Moderate | `next@14.2.35` | Image Optimizer DoS (GHSA-9g9p-9gw9-jx7f) | `>= 15.5.10` |

**Recommendation:** The Next.js vulnerabilities should be addressed before production. Consider upgrading to Next.js 15+ when starting Phase 2. The esbuild vulnerability is dev-only (via vitest) and lower priority.

---

## 9. Recommended Next Steps

These are the exact steps to get from Phase 0 to a Phase 1 commit:

### Step 1: Fix test infrastructure
Create placeholder test files so `pnpm test` passes:
- Create `packages/schema/src/__tests__/index.test.ts` with a basic Zod validation test
- Create `packages/crypto/src/__tests__/index.test.ts` with a basic sign/verify test
- Create `packages/sdk/src/__tests__/index.test.ts` with a basic hash test

### Step 2: Implement `@agent-receipts/schema` (`packages/schema/src/index.ts`)
- Define all Zod schemas: `ActionReceipt`, `SignablePayload`, `CreateReceiptInput`, `CompleteReceiptInput`, `VerifyResponse`, `ListReceiptsQuery`, `ErrorResponse`, `PaginationMeta`
- Export inferred TypeScript types for each schema
- Include enums: `ReceiptType`, `ReceiptStatus`, `Environment`, `ErrorCode`
- Generate `receipt.schema.json` from Zod (optional, can be build step)

### Step 3: Implement `@agent-receipts/crypto` (`packages/crypto/src/index.ts`)
- Implement `getSignablePayload(receipt)` — extract 12 signed fields in order
- Implement `canonicalize(payload)` — `JSON.stringify` with sorted keys
- Implement `signReceipt(payload, privateKey)` — sign canonical JSON with Ed25519 via `@noble/ed25519`
- Implement `verifyReceipt(payload, signature, publicKey)` — verify signature
- Return signature in `ed25519:<base64>` format

### Step 4: Implement key generation (`packages/crypto/bin/generate-keys.ts`)
- Generate Ed25519 key pair using `@noble/ed25519`
- Output hex-encoded private key (64 chars) and public key (64 chars)
- Print instructions for adding to `.env`

### Step 5: Write Phase 1 tests
- Schema: valid input passes, invalid input fails, all required fields enforced, optional fields truly optional
- Crypto: sign/verify round-trip succeeds, tampered payload fails verification, canonical JSON is deterministic (key order doesn't matter), signature format is `ed25519:<base64>`

### Step 6: Commit
```
feat: schema & crypto packages — Phase 1
```

---

## Appendix A: Complete File Listing

```
agent-receipts/
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── turbo.json
├── apps/
│   └── web/
│       ├── package.json
│       └── tsconfig.json
├── examples/
│   ├── basic/
│   │   ├── index.ts          (placeholder)
│   │   └── package.json
│   ├── chained/
│   │   ├── index.ts          (placeholder)
│   │   └── package.json
│   └── modquote/
│       ├── index.ts          (placeholder)
│       └── package.json
├── packages/
│   ├── crypto/
│   │   ├── bin/
│   │   │   └── generate-keys.ts  (stub)
│   │   ├── package.json
│   │   ├── src/
│   │   │   └── index.ts      (empty export)
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── schema/
│   │   ├── package.json
│   │   ├── src/
│   │   │   └── index.ts      (empty export)
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   └── sdk/
│       ├── package.json
│       ├── src/
│       │   └── index.ts      (empty export)
│       ├── tsconfig.json
│       └── tsup.config.ts
├── spec/
│   └── v0.1/
│       └── ACTION-RECEIPT-PROTOCOL.md
└── supabase/
    └── migrations/
        └── 00001_initial_schema.sql
```

## Appendix B: Build & Test Results Summary

| Command | Result |
|---------|--------|
| `pnpm install` | **Pass** — all dependencies resolved |
| `pnpm build` | **Pass** — all 4 workspaces build (7 packages total) |
| `pnpm test` | **Fail** — crypto and sdk have no test files (vitest exits 1); schema similarly empty |
| `tsc --noEmit` (all packages) | **Pass** — zero type errors |
| `pnpm audit` | 3 vulnerabilities (1 high, 2 moderate) — all in `next` and `esbuild` |

## Appendix C: API Routes Status

| Endpoint | Exists? | Auth? | Zod Validation? | Correct Logic? | Notes |
|----------|---------|-------|-----------------|----------------|-------|
| `POST /api/v1/receipts` | No | — | — | — | Phase 2 |
| `PATCH /api/v1/receipts/[id]/complete` | No | — | — | — | Phase 2 |
| `GET /api/v1/receipts/[id]` | No | — | — | — | Phase 2 |
| `GET /api/v1/receipts` (list) | No | — | — | — | Phase 2 |
| `GET /api/v1/verify/[id]` (public) | No | — | — | — | Phase 2 |
| `GET /api/v1/chains/[chainId]` | No | — | — | — | Phase 2 |
| `GET /api/v1/agents` | No | — | — | — | Phase 2 |
| `GET /api/v1/agents/[id]` | No | — | — | — | Phase 2 |
| `GET /api/v1/stats` | No | — | — | — | Phase 2 |
| `POST /api/v1/keys` | No | — | — | — | Phase 2 |
| `GET /api/v1/keys` | No | — | — | — | Phase 2 |
| `DELETE /api/v1/keys/[id]` | No | — | — | — | Phase 2 |
| `GET /.well-known/receipt-public-key.json` | No | — | — | — | Phase 2 |
| `GET /api/v1/health` | No | — | — | — | Phase 2 |

## Appendix D: Frontend Pages Status

| Page | Exists? | Renders? | Complete? | Notes |
|------|---------|----------|-----------|-------|
| Landing page (`/`) | No | — | — | Phase 4 |
| Live demo (`/live`) | No | — | — | Phase 4 |
| Verify page (`/verify/[id]`) | No | — | — | Phase 4 |
| Dashboard overview (`/dashboard`) | No | — | — | Phase 5 |
| Receipt feed (`/receipts`) | No | — | — | Phase 5 |
| Agent scorecards (`/agents`) | No | — | — | Phase 5 |
| Chain visualization (`/chains`) | No | — | — | Phase 5 |
| Settings (`/settings`) | No | — | — | Phase 5 |
