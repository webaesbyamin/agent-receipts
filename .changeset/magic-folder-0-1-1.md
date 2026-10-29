---
"@agent-receipts/magic-folder": patch
"@agent-receipts/mcp-server": patch
"@agent-receipts/schema": patch
"@agent-receipts/crypto": patch
"@agent-receipts/sdk": patch
"@agent-receipts/cli": patch
---

Receipts show the real start time: `ReceiptEngine.create()` takes an optional `started_at` that becomes the signed `timestamp`, and Magic Folder passes the job's start, so Started and Finished are as far apart as "Time taken".
