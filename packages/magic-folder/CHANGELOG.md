# @agent-receipts/magic-folder

## 0.1.2

### Patch Changes

- Supported Node is now stated as 22 or 24 (`engines: >=22 <25`): better-sqlite3 has ready-made builds only for those, so npm warns up front on Node 20 or 26 instead of failing later with a compile error.

- [#8](https://github.com/webaesbyamin/agent-receipts/pull/8) [`83f52c8`](https://github.com/webaesbyamin/agent-receipts/commit/83f52c8f10cd7876b5e68ed3c3b85c5dcb965555) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Windows and Linux support, tested in CI on all three systems. On Windows: sandbox path checks ignore case and handle `\\?\` long paths, UNC and drive paths; a junction pointing outside the job folder is refused; moves and deletes wait out brief file locks; more Office and Windows temp files are ignored. New install guide for Mac, Windows and Linux, including keeping it running (LaunchAgent, Startup folder, systemd). `doctor` flags Node versions outside 22–24, `run` stops cleanly on SIGTERM, the help text covers showing hidden files on every OS, and `BROWSER_RENDER_JS` and `RECEIPT_CSS` are exported. Requires Node 22 or 24: better-sqlite3 ships no ready-made build for Node 20.

- Updated dependencies [[`83f52c8`](https://github.com/webaesbyamin/agent-receipts/commit/83f52c8f10cd7876b5e68ed3c3b85c5dcb965555)]:
  - @agent-receipts/mcp-server@0.5.2

## 0.1.1

### Patch Changes

- [`3e65f05`](https://github.com/webaesbyamin/agent-receipts/commit/3e65f051befd049eccb8ac35bae776c972f3fb20) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Receipts show the real start time: `ReceiptEngine.create()` takes an optional `started_at` that becomes the signed `timestamp`, and Magic Folder passes the job's start, so Started and Finished are as far apart as "Time taken".

- [`3e65f05`](https://github.com/webaesbyamin/agent-receipts/commit/3e65f051befd049eccb8ac35bae776c972f3fb20) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Cleaner Magic Folder receipts. Summaries no longer show the job's internal `input/` and `output/` folders or job paths. New recipe field `changes_report: true`: the runner compares each original with its "(fixed)" copy and writes `changes.md` itself, so it lists only real changes. The Fix typos starter recipe uses it. Branded verify pages (`verify-page --trust-key`) no longer show the key input box.

- Updated dependencies [[`3e65f05`](https://github.com/webaesbyamin/agent-receipts/commit/3e65f051befd049eccb8ac35bae776c972f3fb20)]:
  - @agent-receipts/mcp-server@0.5.1
  - @agent-receipts/schema@0.5.1
  - @agent-receipts/crypto@0.5.1

## 0.1.0

### Minor Changes

- [#3](https://github.com/webaesbyamin/agent-receipts/pull/3) [`27347ae`](https://github.com/webaesbyamin/agent-receipts/commit/27347aec80a793f71853ce30794aa67402ea7ae9) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - New package: Magic Folder. Drop a file into a job folder; an agent does the work; the result comes back with a signed, self-checking receipt.html. Includes starter recipes, approvals, a CLI (`magic-folder init|run|verify|verify-page`) and the public verify page.

- [#4](https://github.com/webaesbyamin/agent-receipts/pull/4) [`85ea6c0`](https://github.com/webaesbyamin/agent-receipts/commit/85ea6c0ff3c6a3199519c89d5297be8b8f09869f) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Ollama engine: run Magic Folder jobs free on a local model. Tools mode (sandboxed read/write/list/search/replace implemented by Magic Folder) for tool-calling models, JSON mode for the rest, vision support, per-recipe `engine:`, `--engine ollama`, and `magic-folder doctor`. Local jobs cost 0 credits and their receipts say so.

- [#4](https://github.com/webaesbyamin/agent-receipts/pull/4) Verify pages can trust a public key (`verify-page --trust-key <public key>`), so they also check `receipt.json` files. Ollama JSON-mode receipts record `engine_mode` and no longer list tool calls that weren't made.

### Patch Changes

- Updated dependencies [[`27347ae`](https://github.com/webaesbyamin/agent-receipts/commit/27347aec80a793f71853ce30794aa67402ea7ae9)]:
  - @agent-receipts/schema@0.5.0
  - @agent-receipts/crypto@0.5.0
  - @agent-receipts/mcp-server@0.5.0
