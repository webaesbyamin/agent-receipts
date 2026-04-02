import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SqliteReceiptStore as ReceiptStore } from '../storage/sqlite-receipt-store.js'
import { KeyManager } from '../storage/key-manager.js'
import { ConfigManager } from '../storage/config-manager.js'
import { ReceiptEngine } from '../engine/receipt-engine.js'
import { registerGetStarted } from '../tools/get-started.js'

describe('get_started tool', () => {
  let tmpDir: string
  let engine: ReceiptEngine
  let server: McpServer

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'get-started-'))
    const store = new ReceiptStore(tmpDir)
    await store.init()
    const km = new KeyManager(tmpDir)
    await km.init()
    const cm = new ConfigManager(tmpDir)
    await cm.init()
    engine = new ReceiptEngine(store, km, cm)
    server = new McpServer({ name: 'test', version: '0.0.1' })
    registerGetStarted(server, engine)
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('returns text content with the guide', async () => {
    // Access the registered tool handler via the server internals
    // Since McpServer doesn't expose a direct call method, we test the function directly
    const { registerGetStarted: register } = await import('../tools/get-started.js')

    // Create a capture for the tool handler
    let capturedHandler: ((...args: unknown[]) => Promise<unknown>) | null = null
    const mockServer = {
      tool: (_name: string, _desc: string, _schema: unknown, handler: (...args: unknown[]) => Promise<unknown>) => {
        capturedHandler = handler
      },
    } as unknown as McpServer

    register(mockServer, engine)
    expect(capturedHandler).not.toBeNull()

    const result = await capturedHandler!({}) as { content: Array<{ type: string; text: string }> }
    expect(result.content).toHaveLength(1)
    expect(result.content[0]!.type).toBe('text')
    expect(result.content[0]!.text.length).toBeGreaterThan(100)
  })

  it('includes key tool names in the guide', async () => {
    let capturedHandler: ((...args: unknown[]) => Promise<unknown>) | null = null
    const mockServer = {
      tool: (_name: string, _desc: string, _schema: unknown, handler: (...args: unknown[]) => Promise<unknown>) => {
        capturedHandler = handler
      },
    } as unknown as McpServer

    registerGetStarted(mockServer, engine)
    const result = await capturedHandler!({}) as { content: Array<{ type: string; text: string }> }
    const text = result.content[0]!.text

    expect(text).toContain('track_action')
    expect(text).toContain('create_receipt')
    expect(text).toContain('complete_receipt')
    expect(text).toContain('verify_receipt')
    expect(text).toContain('judge_receipt')
    expect(text).toContain('complete_judgment')
    expect(text).toContain('list_receipts')
    expect(text).toContain('get_chain')
    expect(text).toContain('get_started')
    expect(text).toContain('generate_invoice')
    expect(text).toContain('cleanup_expired')
  })

  it('requires no parameters (empty schema)', async () => {
    let capturedSchema: unknown = null
    const mockServer = {
      tool: (_name: string, _desc: string, schema: unknown, _handler: unknown) => {
        capturedSchema = schema
      },
    } as unknown as McpServer

    registerGetStarted(mockServer, engine)
    expect(capturedSchema).toEqual({})
  })
})
