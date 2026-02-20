import { AgentReceipts } from '@agent-receipts/sdk'
import { ReceiptStore, KeyManager, ConfigManager } from '@agent-receipts/mcp-server'

let sdkInstance: AgentReceipts | null = null
let storeInstance: ReceiptStore | null = null
let keyManagerInstance: KeyManager | null = null
let configManagerInstance: ConfigManager | null = null

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

export { getDataDir }
