# @agent-receipts/cli

## 0.6.0

### Minor Changes

- [#20](https://github.com/webaesbyamin/agent-receipts/pull/20) [`33cff63`](https://github.com/webaesbyamin/agent-receipts/commit/33cff63f2d38ebd770a7c26a0cceadbd613b04b3) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - `agent-receipts hooks install` signs a receipt for every file edit, file write, notebook edit and shell command Claude Code makes, chained per session, plus a summary when the session ends. Receipts hold hashes only (no commands, file contents or output; `--store-commands` adds a short redacted label). The hooks run in the background, never block Claude Code, and log problems to `~/.agent-receipts/hooks.log`. `hooks uninstall` puts settings.json back as it was; `hooks status` shows where they're installed. Also available as a Claude Code plugin: `claude plugin marketplace add webaesbyamin/agent-receipts`, then `claude plugin install agent-receipts@agent-receipts`.

- [#20](https://github.com/webaesbyamin/agent-receipts/pull/20) [`675c817`](https://github.com/webaesbyamin/agent-receipts/commit/675c81727c2d9cf43fc487db90b84e0f1f95e999) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - `agent-receipts proxy [--name <server-name>] -- <command> [args...]` runs any stdio MCP server behind a passthrough that signs one receipt per tool call (`mcp.<name>.<tool>`, one chain per proxy session, hashes of arguments and result only, `failed` on `isError` or a JSON-RPC error). Every message passes through unchanged; the response is forwarded before the receipt is signed. Remote (HTTP) MCP servers aren't covered yet.

- [#20](https://github.com/webaesbyamin/agent-receipts/pull/20) [`33cff63`](https://github.com/webaesbyamin/agent-receipts/commit/33cff63f2d38ebd770a7c26a0cceadbd613b04b3) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Agent Receipts now uses Node's built-in SQLite (node:sqlite) instead of better-sqlite3. There is no native module left, so nothing to compile and no install script to approve: install with plain `npm install -g @agent-receipts/magic-folder` (no `--allow-scripts`). Node 26 works too. On Node 22, and on 24 before 24.15, Node calls built-in SQLite experimental; Agent Receipts hides that one notice. Existing `receipts.db` files open unchanged.

  **Breaking:** requires Node 22.16 or later (the first 22.x whose SQLite has full-text search). On an older Node every command stops with a message naming the version to install. `better-sqlite3` is no longer a dependency; code that called `store.getDb()` gets a small SQLite wrapper (`prepare`, `exec`, `transaction`, `close`) instead of a better-sqlite3 `Database`.

  Memory search starts from the full-text index: about 1 ms instead of about 250 ms at 2,000 matching observations. Fixes signing with different keys when several processes create the first key at the same moment. `schema` and `crypto` are unchanged apart from the version, which moves with the linked core packages.

### Patch Changes

- Updated dependencies [[`33cff63`](https://github.com/webaesbyamin/agent-receipts/commit/33cff63f2d38ebd770a7c26a0cceadbd613b04b3)]:
  - @agent-receipts/schema@0.6.0
  - @agent-receipts/crypto@0.6.0
  - @agent-receipts/mcp-server@0.6.0

## 0.5.2

### Patch Changes

- Supported Node is now stated as 22 or 24 (`engines: >=22 <25`): better-sqlite3 has ready-made builds only for those, so npm warns up front on Node 20 or 26 instead of failing later with a compile error.

- Updated dependencies [[`83f52c8`](https://github.com/webaesbyamin/agent-receipts/commit/83f52c8f10cd7876b5e68ed3c3b85c5dcb965555)]:
  - @agent-receipts/mcp-server@0.5.2

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
