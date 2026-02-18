import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import type { AppConfig } from '../types.js'

const DEFAULT_CONFIG: AppConfig = {
  agentId: 'local-agent',
  orgId: 'local-org',
  environment: 'production',
}

export class ConfigManager {
  private configPath: string
  private config: AppConfig = { ...DEFAULT_CONFIG }

  constructor(dataDir: string) {
    this.configPath = join(dataDir, 'config.json')
  }

  async init(): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true })
    await this.load()
  }

  private async load(): Promise<void> {
    try {
      const data = await readFile(this.configPath, 'utf-8')
      const saved = JSON.parse(data) as Partial<AppConfig>
      this.config = { ...DEFAULT_CONFIG, ...saved }
    } catch {
      // Config file doesn't exist — use defaults
    }

    // Environment variable overrides
    const envAgentId = process.env['AGENT_RECEIPTS_AGENT_ID']
    if (envAgentId) this.config.agentId = envAgentId

    const envOrgId = process.env['AGENT_RECEIPTS_ORG_ID']
    if (envOrgId) this.config.orgId = envOrgId

    const envEnvironment = process.env['AGENT_RECEIPTS_ENVIRONMENT']
    if (envEnvironment === 'production' || envEnvironment === 'staging' || envEnvironment === 'test') {
      this.config.environment = envEnvironment
    }
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true })
    await writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
  }

  getConfig(): AppConfig {
    return { ...this.config }
  }

  async update(partial: Partial<AppConfig>): Promise<void> {
    this.config = { ...this.config, ...partial }
    await this.save()
  }

  static getDefaultDataDir(): string {
    return process.env['AGENT_RECEIPTS_DATA_DIR'] ?? join(homedir(), '.agent-receipts')
  }
}
