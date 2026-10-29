# @agent-receipts/dashboard

## 0.5.1

### Patch Changes

- Fix: the installed dashboard started in demo mode (demo banner and demo data instead of your own receipts). The package build now forces demo mode off and no longer ships `.env` files. The hosted demo on Vercel is unchanged.

## 0.5.0

### Minor Changes

- [#3](https://github.com/webaesbyamin/agent-receipts/pull/3) [`27347ae`](https://github.com/webaesbyamin/agent-receipts/commit/27347aec80a793f71853ce30794aa67402ea7ae9) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Receipt format v2: every field is signed (summary, cost, model, metadata, files and the chain link, not just 12 core fields). New `verifyAnyReceipt()` checks v1 and v2 and can require v2 to block downgrades. Receipts carry `key_id`, a `files` manifest and `prev_receipt_hash`; `verifyChain()` / `agent-receipts verify-chain` detect edited, removed and forked receipts. Finalized receipts are append-only. Fixes JSON-to-SQLite migration in the ESM build.

  **Breaking:** v2 receipts don't verify with `verifyReceipt(getSignablePayload(r), …)`. Use `verifyAnyReceipt(r, publicKey)`.
