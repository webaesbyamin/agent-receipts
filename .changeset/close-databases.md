---
"@agent-receipts/mcp-server": patch
"@agent-receipts/sdk": patch
---

New `SqliteReceiptStore.close()` and `AgentReceipts.close()`. On Windows a data folder can't be moved or deleted while its database is open.
