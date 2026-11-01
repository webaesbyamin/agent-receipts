---
"@agent-receipts/schema": minor
"@agent-receipts/crypto": minor
"@agent-receipts/mcp-server": minor
"@agent-receipts/sdk": minor
"@agent-receipts/cli": minor
"@agent-receipts/dashboard": minor
"@agent-receipts/magic-folder": minor
---

Agent Receipts now uses Node's built-in SQLite (node:sqlite) instead of better-sqlite3. There is no native module left, so nothing to compile and no install script to approve: install with plain `npm install -g @agent-receipts/magic-folder` (no `--allow-scripts`). Node 26 works too. On Node 22, and on 24 before 24.15, Node calls built-in SQLite experimental; Agent Receipts hides that one notice. Existing `receipts.db` files open unchanged.

**Breaking:** requires Node 22.16 or later (the first 22.x whose SQLite has full-text search). On an older Node every command stops with a message naming the version to install. `better-sqlite3` is no longer a dependency; code that called `store.getDb()` gets a small SQLite wrapper (`prepare`, `exec`, `transaction`, `close`) instead of a better-sqlite3 `Database`.

Memory search starts from the full-text index: about 1 ms instead of about 250 ms at 2,000 matching observations. Fixes signing with different keys when several processes create the first key at the same moment. `schema` and `crypto` are unchanged apart from the version, which moves with the linked core packages.
