# Agent Receipts for Claude Code

A signed receipt for every file edit, file write, notebook edit and shell command Claude Code makes, and a summary when the session ends. Receipts are Ed25519-signed, chained per session, and stored in `~/.agent-receipts` on your machine. They hold hashes only: no commands, file contents or output.

```
claude plugin marketplace add webaesbyamin/agent-receipts
claude plugin install agent-receipts@agent-receipts
```

Needs Node.js 22.16 or later on your `PATH`. Check a session with `npx @agent-receipts/cli verify-chain <session id>`.

`hooks/agent-receipts-claude-code-hook.mjs` is built from `packages/cli` (`pnpm build` there); don't edit it by hand. The CLI installs the same hooks without the plugin: `npx @agent-receipts/cli hooks install`.
