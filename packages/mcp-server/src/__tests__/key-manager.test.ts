import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { KeyManager } from '../storage/key-manager.js'

describe('KeyManager', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'key-manager-'))
    // Clear env var before each test
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']
  })

  afterEach(async () => {
    delete process.env['RECEIPT_SIGNING_PRIVATE_KEY']
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('auto-generates keys on first init', async () => {
    const km = new KeyManager(tmpDir)
    await km.init()
    const pubKey = km.getPublicKey()
    const privKey = km.getPrivateKey()
    expect(pubKey).toMatch(/^[a-f0-9]{64}$/)
    expect(privKey).toMatch(/^[a-f0-9]{64}$/)
  })

  it('persists keys to files', async () => {
    const km = new KeyManager(tmpDir)
    await km.init()
    const pubKey = km.getPublicKey()

    // Read persisted file
    const savedPriv = (await readFile(join(tmpDir, 'keys', 'private.key'), 'utf-8')).trim()
    const savedPub = (await readFile(join(tmpDir, 'keys', 'public.key'), 'utf-8')).trim()
    expect(savedPub).toBe(pubKey)
    expect(savedPriv).toMatch(/^[a-f0-9]{64}$/)
  })

  it('reloads keys from files on subsequent init', async () => {
    const km1 = new KeyManager(tmpDir)
    await km1.init()
    const key1 = km1.getPublicKey()

    const km2 = new KeyManager(tmpDir)
    await km2.init()
    const key2 = km2.getPublicKey()

    expect(key1).toBe(key2)
  })

  it('uses env var when set', async () => {
    // First generate a key so we know a valid one
    const km1 = new KeyManager(tmpDir)
    await km1.init()
    const privKey = km1.getPrivateKey()

    // Now use a fresh dir but set env var
    const tmpDir2 = await mkdtemp(join(tmpdir(), 'key-manager-env-'))
    process.env['RECEIPT_SIGNING_PRIVATE_KEY'] = privKey
    const km2 = new KeyManager(tmpDir2)
    await km2.init()
    expect(km2.getPrivateKey()).toBe(privKey)
    expect(km2.getPublicKey()).toBe(km1.getPublicKey())

    await rm(tmpDir2, { recursive: true, force: true })
  })

  it('env var takes priority over file', async () => {
    // Generate file-based key
    const km1 = new KeyManager(tmpDir)
    await km1.init()
    const fileKey = km1.getPrivateKey()

    // Set different env var key
    const tmpDir2 = await mkdtemp(join(tmpdir(), 'key-manager-prio-'))
    const km2 = new KeyManager(tmpDir2)
    await km2.init()
    const envKey = km2.getPrivateKey()

    // Now use first dir with env set to second key
    process.env['RECEIPT_SIGNING_PRIVATE_KEY'] = envKey
    const km3 = new KeyManager(tmpDir)
    await km3.init()
    expect(km3.getPrivateKey()).toBe(envKey)
    expect(km3.getPrivateKey()).not.toBe(fileKey)

    await rm(tmpDir2, { recursive: true, force: true })
  })

  it('throws when accessing keys before init', () => {
    const km = new KeyManager(tmpDir)
    expect(() => km.getPublicKey()).toThrow('not initialized')
    expect(() => km.getPrivateKey()).toThrow('not initialized')
  })
})
