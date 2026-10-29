---
"@agent-receipts/schema": minor
"@agent-receipts/crypto": minor
"@agent-receipts/mcp-server": minor
"@agent-receipts/sdk": minor
"@agent-receipts/cli": minor
"@agent-receipts/dashboard": minor
---

Receipt format v2: every field is signed (summary, cost, model, metadata, files and the chain link, not just 12 core fields). New `verifyAnyReceipt()` checks v1 and v2 and can require v2 to block downgrades. Receipts carry `key_id`, a `files` manifest and `prev_receipt_hash`; `verifyChain()` / `agent-receipts verify-chain` detect edited, removed and forked receipts. Finalized receipts are append-only. Fixes JSON-to-SQLite migration in the ESM build.

**Breaking:** v2 receipts don't verify with `verifyReceipt(getSignablePayload(r), …)`. Use `verifyAnyReceipt(r, publicKey)`.
