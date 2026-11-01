# @agent-receipts/schema

## 0.6.0

### Minor Changes

- [#20](https://github.com/webaesbyamin/agent-receipts/pull/20) [`33cff63`](https://github.com/webaesbyamin/agent-receipts/commit/33cff63f2d38ebd770a7c26a0cceadbd613b04b3) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Agent Receipts now uses Node's built-in SQLite (node:sqlite) instead of better-sqlite3. There is no native module left, so nothing to compile and no install script to approve: install with plain `npm install -g @agent-receipts/magic-folder` (no `--allow-scripts`). Node 26 works too. On Node 22, and on 24 before 24.15, Node calls built-in SQLite experimental; Agent Receipts hides that one notice. Existing `receipts.db` files open unchanged.

  **Breaking:** requires Node 22.16 or later (the first 22.x whose SQLite has full-text search). On an older Node every command stops with a message naming the version to install. `better-sqlite3` is no longer a dependency; code that called `store.getDb()` gets a small SQLite wrapper (`prepare`, `exec`, `transaction`, `close`) instead of a better-sqlite3 `Database`.

  Memory search starts from the full-text index: about 1 ms instead of about 250 ms at 2,000 matching observations. Fixes signing with different keys when several processes create the first key at the same moment. `schema` and `crypto` are unchanged apart from the version, which moves with the linked core packages.

## 0.5.1

### Patch Changes

- [`3e65f05`](https://github.com/webaesbyamin/agent-receipts/commit/3e65f051befd049eccb8ac35bae776c972f3fb20) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Receipts show the real start time: `ReceiptEngine.create()` takes an optional `started_at` that becomes the signed `timestamp`, and Magic Folder passes the job's start, so Started and Finished are as far apart as "Time taken".

## 0.5.0

### Minor Changes

- [#3](https://github.com/webaesbyamin/agent-receipts/pull/3) [`27347ae`](https://github.com/webaesbyamin/agent-receipts/commit/27347aec80a793f71853ce30794aa67402ea7ae9) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Receipt format v2: every field is signed (summary, cost, model, metadata, files and the chain link, not just 12 core fields). New `verifyAnyReceipt()` checks v1 and v2 and can require v2 to block downgrades. Receipts carry `key_id`, a `files` manifest and `prev_receipt_hash`; `verifyChain()` / `agent-receipts verify-chain` detect edited, removed and forked receipts. Finalized receipts are append-only. Fixes JSON-to-SQLite migration in the ESM build.

  **Breaking:** v2 receipts don't verify with `verifyReceipt(getSignablePayload(r), …)`. Use `verifyAnyReceipt(r, publicKey)`.

## 0.1.0

### Minor Changes

- Initial public release — local-first receipt signing, MCP server, SDK, and CLI
