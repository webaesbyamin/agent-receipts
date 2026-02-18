import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigManager } from '../storage/config-manager.js'

describe('ConfigManager', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'config-manager-'))
    delete process.env['AGENT_RECEIPTS_AGENT_ID']
    delete process.env['AGENT_RECEIPTS_ORG_ID']
    delete process.env['AGENT_RECEIPTS_ENVIRONMENT']
    delete process.env['AGENT_RECEIPTS_DATA_DIR']
  })

  afterEach(async () => {
    delete process.env['AGENT_RECEIPTS_AGENT_ID']
    delete process.env['AGENT_RECEIPTS_ORG_ID']
    delete process.env['AGENT_RECEIPTS_ENVIRONMENT']
    delete process.env['AGENT_RECEIPTS_DATA_DIR']
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('uses default config values', async () => {
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    const config = cm.getConfig()
    expect(config.agentId).toBe('local-agent')
    expect(config.orgId).toBe('local-org')
    expect(config.environment).toBe('production')
  })

  it('persists config to file', async () => {
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    await cm.update({ agentId: 'custom-agent' })

    const cm2 = new ConfigManager(tmpDir)
    await cm2.init()
    expect(cm2.getConfig().agentId).toBe('custom-agent')
  })

  it('respects env var AGENT_RECEIPTS_AGENT_ID', async () => {
    process.env['AGENT_RECEIPTS_AGENT_ID'] = 'env-agent'
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    expect(cm.getConfig().agentId).toBe('env-agent')
  })

  it('respects env var AGENT_RECEIPTS_ORG_ID', async () => {
    process.env['AGENT_RECEIPTS_ORG_ID'] = 'env-org'
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    expect(cm.getConfig().orgId).toBe('env-org')
  })

  it('respects env var AGENT_RECEIPTS_ENVIRONMENT', async () => {
    process.env['AGENT_RECEIPTS_ENVIRONMENT'] = 'test'
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    expect(cm.getConfig().environment).toBe('test')
  })

  it('ignores invalid environment values', async () => {
    process.env['AGENT_RECEIPTS_ENVIRONMENT'] = 'invalid'
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    expect(cm.getConfig().environment).toBe('production')
  })

  it('env vars override file config', async () => {
    const cm1 = new ConfigManager(tmpDir)
    await cm1.init()
    await cm1.update({ agentId: 'file-agent' })

    process.env['AGENT_RECEIPTS_AGENT_ID'] = 'env-agent'
    const cm2 = new ConfigManager(tmpDir)
    await cm2.init()
    expect(cm2.getConfig().agentId).toBe('env-agent')
  })

  it('getConfig returns a copy', async () => {
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    const config1 = cm.getConfig()
    const config2 = cm.getConfig()
    expect(config1).toEqual(config2)
    expect(config1).not.toBe(config2)
  })

  it('getDefaultDataDir returns env var when set', () => {
    process.env['AGENT_RECEIPTS_DATA_DIR'] = '/custom/dir'
    expect(ConfigManager.getDefaultDataDir()).toBe('/custom/dir')
  })

  it('getDefaultDataDir returns home dir path when env not set', () => {
    const dir = ConfigManager.getDefaultDataDir()
    expect(dir).toContain('.agent-receipts')
  })
})
