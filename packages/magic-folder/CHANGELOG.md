# @agent-receipts/magic-folder

## 0.1.0

### Minor Changes

- [#3](https://github.com/webaesbyamin/agent-receipts/pull/3) [`27347ae`](https://github.com/webaesbyamin/agent-receipts/commit/27347aec80a793f71853ce30794aa67402ea7ae9) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - New package: Magic Folder. Drop a file into a job folder; an agent does the work; the result comes back with a signed, self-checking receipt.html. Includes starter recipes, approvals, a CLI (`magic-folder init|run|verify|verify-page`) and the public verify page.

- [#4](https://github.com/webaesbyamin/agent-receipts/pull/4) [`85ea6c0`](https://github.com/webaesbyamin/agent-receipts/commit/85ea6c0ff3c6a3199519c89d5297be8b8f09869f) Thanks [@webaesbyamin](https://github.com/webaesbyamin)! - Ollama engine: run Magic Folder jobs free on a local model. Tools mode (sandboxed read/write/list/search/replace implemented by Magic Folder) for tool-calling models, JSON mode for the rest, vision support, per-recipe `engine:`, `--engine ollama`, and `magic-folder doctor`. Local jobs cost 0 credits and their receipts say so.

### Patch Changes

- Updated dependencies [[`27347ae`](https://github.com/webaesbyamin/agent-receipts/commit/27347aec80a793f71853ce30794aa67402ea7ae9)]:
  - @agent-receipts/schema@0.5.0
  - @agent-receipts/crypto@0.5.0
  - @agent-receipts/mcp-server@0.5.0
