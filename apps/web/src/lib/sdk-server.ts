import { AgentReceipts } from '@agent-receipts/sdk'
import { ReceiptStore, KeyManager, ConfigManager, MemoryStore, MemoryEngine, ReceiptEngine } from '@agent-receipts/mcp-server'

let sdkInstance: AgentReceipts | null = null
let storeInstance: ReceiptStore | null = null
let keyManagerInstance: KeyManager | null = null
let configManagerInstance: ConfigManager | null = null
let memoryStoreInstance: MemoryStore | null = null
let memoryEngineInstance: MemoryEngine | null = null

function getDataDir(): string {
  return process.env.AGENT_RECEIPTS_DATA_DIR ?? ConfigManager.getDefaultDataDir()
}

export function getSDK(): AgentReceipts {
  if (!sdkInstance) {
    sdkInstance = new AgentReceipts({
      dataDir: process.env.AGENT_RECEIPTS_DATA_DIR || undefined,
    })
  }
  return sdkInstance
}

export async function getStore(): Promise<ReceiptStore> {
  if (!storeInstance) {
    storeInstance = new ReceiptStore(getDataDir())
    await storeInstance.init()
  }
  return storeInstance
}

export async function getKeyManager(): Promise<KeyManager> {
  if (!keyManagerInstance) {
    keyManagerInstance = new KeyManager(getDataDir())
    await keyManagerInstance.init()
  }
  return keyManagerInstance
}

export async function getConfigManager(): Promise<ConfigManager> {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager(getDataDir())
    await configManagerInstance.init()
  }
  return configManagerInstance
}

export async function getMemoryStore(): Promise<MemoryStore> {
  if (!memoryStoreInstance) {
    const store = await getStore()
    memoryStoreInstance = new MemoryStore(store.getDb())
    memoryStoreInstance.init()
  }
  return memoryStoreInstance
}

export async function getMemoryEngine(): Promise<MemoryEngine> {
  if (!memoryEngineInstance) {
    const store = await getStore()
    const keyManager = await getKeyManager()
    const configManager = await getConfigManager()
    const receiptEngine = new ReceiptEngine(store, keyManager as unknown as KeyManager, configManager as unknown as ConfigManager)
    const memStore = await getMemoryStore()
    memoryEngineInstance = new MemoryEngine(receiptEngine, memStore)
  }
  return memoryEngineInstance
}

export { getDataDir }
