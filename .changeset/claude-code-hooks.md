---
"@agent-receipts/cli": minor
---

`agent-receipts hooks install` signs a receipt for every file edit, file write, notebook edit and shell command Claude Code makes, chained per session, plus a summary when the session ends. Receipts hold hashes only (no commands, file contents or output; `--store-commands` adds a short redacted label). The hooks run in the background, never block Claude Code, and log problems to `~/.agent-receipts/hooks.log`. `hooks uninstall` puts settings.json back as it was; `hooks status` shows where they're installed. Also available as a Claude Code plugin: `claude plugin marketplace add webaesbyamin/agent-receipts`, then `claude plugin install agent-receipts@agent-receipts`.
