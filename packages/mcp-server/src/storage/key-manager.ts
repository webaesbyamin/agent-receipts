import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { generateKeyPair, getPublicKeyFromPrivate } from '@agent-receipts/crypto'

export class KeyManager {
  private keysDir: string
  private privateKey: string | null = null
  private publicKey: string | null = null

  constructor(dataDir: string) {
    this.keysDir = join(dataDir, 'keys')
  }

  async init(): Promise<void> {
    await mkdir(this.keysDir, { recursive: true })
    await this.loadKeys()
  }

  private async loadKeys(): Promise<void> {
    // Priority 1: Environment variable
    const envKey = process.env['RECEIPT_SIGNING_PRIVATE_KEY']
    if (envKey) {
      this.privateKey = envKey
      this.publicKey = getPublicKeyFromPrivate(envKey)
      return
    }

    // Priority 2: File-based key
    const privateKeyPath = join(this.keysDir, 'private.key')
    try {
      this.privateKey = (await readFile(privateKeyPath, 'utf-8')).trim()
      this.publicKey = getPublicKeyFromPrivate(this.privateKey)
      return
    } catch {
      // Key file doesn't exist — auto-generate
    }

    // Priority 3: Auto-generate
    const keyPair = generateKeyPair()
    this.privateKey = keyPair.privateKey
    this.publicKey = keyPair.publicKey

    // Persist the key
    await writeFile(privateKeyPath, this.privateKey, { encoding: 'utf-8', mode: 0o600 })
    await chmod(privateKeyPath, 0o600)

    const publicKeyPath = join(this.keysDir, 'public.key')
    await writeFile(publicKeyPath, this.publicKey, 'utf-8')
  }

  getPrivateKey(): string {
    if (!this.privateKey) {
      throw new Error('KeyManager not initialized — call init() first')
    }
    return this.privateKey
  }

  getPublicKey(): string {
    if (!this.publicKey) {
      throw new Error('KeyManager not initialized — call init() first')
    }
    return this.publicKey
  }
}
