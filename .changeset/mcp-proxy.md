---
"@agent-receipts/cli": minor
---

`agent-receipts proxy [--name <server-name>] -- <command> [args...]` runs any stdio MCP server behind a passthrough that signs one receipt per tool call (`mcp.<name>.<tool>`, one chain per proxy session, hashes of arguments and result only, `failed` on `isError` or a JSON-RPC error). Every message passes through unchanged; the response is forwarded before the receipt is signed. Remote (HTTP) MCP servers aren't covered yet.
