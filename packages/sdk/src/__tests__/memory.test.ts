import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentReceipts } from '../index'

describe('SDK Memory Methods', () => {
  let tmpDir: string
  let ar: AgentReceipts

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sdk-memory-'))
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']
    ar = new AgentReceipts({ dataDir: tmpDir })
  })

  afterEach(async () => {
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('observe creates entity and observation', async () => {
    const result = await ar.observe({
      entityName: 'SDKTest',
      entityType: 'person',
      content: 'Test from SDK',
      agentId: 'sdk_agent',
    })
    expect(result.entity.name).toBe('SDKTest')
    expect(result.observation.content).toBe('Test from SDK')
    expect(result.receipt.receipt_type).toBe('memory')
  })

  it('recall returns observed data', async () => {
    await ar.observe({
      entityName: 'RecallSDK',
      entityType: 'fact',
      content: 'SDK recall test',
      agentId: 'sdk_agent',
    })

    const result = await ar.recall({ agentId: 'sdk_agent' })
    expect(result.entities.length).toBeGreaterThanOrEqual(1)
    expect(result.observations.length).toBeGreaterThanOrEqual(1)
  })

  it('forget soft-deletes and returns receipt', async () => {
    const observed = await ar.observe({
      entityName: 'ForgetSDK',
      entityType: 'fact',
      content: 'Will forget',
      agentId: 'sdk_agent',
    })

    const result = await ar.forget({
      observationId: observed.observation.observation_id,
      agentId: 'sdk_agent',
    })
    expect(result.receipt.receipt_type).toBe('memory')
  })

  it('entities lists entities', async () => {
    await ar.observe({ entityName: 'E1', entityType: 'person', content: 'f', agentId: 'a' })
    const result = await ar.entities()
    expect(result.data.length).toBeGreaterThanOrEqual(1)
  })

  it('memoryAudit returns report', async () => {
    await ar.observe({ entityName: 'AuditSDK', entityType: 'project', content: 'f', agentId: 'a' })
    const report = await ar.memoryAudit()
    expect(report.total_entities).toBeGreaterThanOrEqual(1)
  })
})
