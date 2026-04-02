import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SqliteReceiptStore as ReceiptStore } from './storage/sqlite-receipt-store.js'
import { KeyManager } from './storage/key-manager.js'
import { ConfigManager } from './storage/config-manager.js'
import { ReceiptEngine } from './engine/receipt-engine.js'
import { registerAllTools } from './tools/index.js'

async function main(): Promise<void> {
  const dataDir = ConfigManager.getDefaultDataDir()

  // Initialize storage
  const store = new ReceiptStore(dataDir)
  await store.init()

  const keyManager = new KeyManager(dataDir)
  await keyManager.init()

  const configManager = new ConfigManager(dataDir)
  await configManager.init()

  // Create engine
  const engine = new ReceiptEngine(store, keyManager, configManager)

  // Create MCP server
  const server = new McpServer({
    name: 'agent-receipts',
    version: '0.2.7',
  })

  // Register all tools
  registerAllTools(server, engine)

  // Start stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('Agent Receipts MCP server running on stdio')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
