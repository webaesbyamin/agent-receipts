# @agent-receipts/cli

## 0.5.1

### Patch Changes

- [`3e65f05`](https://github.com/webaesbyamin/agent-receipts/commit/3e65f051befd049eccb8ac35bae776c972f3fb20) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Receipts show the real start time: `ReceiptEngine.create()` takes an optional `started_at` that becomes the signed `timestamp`, and Magic Folder passes the job's start, so Started and Finished are as far apart as "Time taken".

- Updated dependencies [[`3e65f05`](https://github.com/webaesbyamin/agent-receipts/commit/3e65f051befd049eccb8ac35bae776c972f3fb20)]:
  - @agent-receipts/mcp-server@0.5.1
  - @agent-receipts/crypto@0.5.1

## 0.5.0

### Minor Changes

- [#3](https://github.com/webaesbyamin/agent-receipts/pull/3) [`27347ae`](https://github.com/webaesbyamin/agent-receipts/commit/27347aec80a793f71853ce30794aa67402ea7ae9) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Receipt format v2: every field is signed (summary, cost, model, metadata, files and the chain link, not just 12 core fields). New `verifyAnyReceipt()` checks v1 and v2 and can require v2 to block downgrades. Receipts carry `key_id`, a `files` manifest and `prev_receipt_hash`; `verifyChain()` / `agent-receipts verify-chain` detect edited, removed and forked receipts. Finalized receipts are append-only. Fixes JSON-to-SQLite migration in the ESM build.

  **Breaking:** v2 receipts don't verify with `verifyReceipt(getSignablePayload(r), …)`. Use `verifyAnyReceipt(r, publicKey)`.

### Patch Changes

- Updated dependencies [[`27347ae`](https://github.com/webaesbyamin/agent-receipts/commit/27347aec80a793f71853ce30794aa67402ea7ae9)]:
  - @agent-receipts/crypto@0.5.0
  - @agent-receipts/mcp-server@0.5.0

## 0.1.0

### Minor Changes

- Initial public release — local-first receipt signing, MCP server, SDK, and CLI

### Patch Changes

- Updated dependencies []:
  - @agent-receipts/crypto@0.2.0
  - @agent-receipts/mcp-server@0.2.0
