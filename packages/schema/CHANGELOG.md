# @agent-receipts/schema

## 0.5.0

### Minor Changes

- [#3](https://github.com/webaesbyamin/agent-receipts/pull/3) [`27347ae`](https://github.com/webaesbyamin/agent-receipts/commit/27347aec80a793f71853ce30794aa67402ea7ae9) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Receipt format v2: every field is signed (summary, cost, model, metadata, files and the chain link, not just 12 core fields). New `verifyAnyReceipt()` checks v1 and v2 and can require v2 to block downgrades. Receipts carry `key_id`, a `files` manifest and `prev_receipt_hash`; `verifyChain()` / `agent-receipts verify-chain` detect edited, removed and forked receipts. Finalized receipts are append-only. Fixes JSON-to-SQLite migration in the ESM build.

  **Breaking:** v2 receipts don't verify with `verifyReceipt(getSignablePayload(r), …)`. Use `verifyAnyReceipt(r, publicKey)`.

## 0.1.0

### Minor Changes

- Initial public release — local-first receipt signing, MCP server, SDK, and CLI
