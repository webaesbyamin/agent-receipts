import { readFile, writeFile, mkdir, chmod, link, unlink } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
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

    // Priority 3: Auto-generate. Several processes can get here at once (e.g.
    // Claude Code hooks firing together on first use), so the key is written to
    // a temp file and hard-linked into place: the link fails if a key already
    // exists, exactly one key wins, and every process uses that one.
    const keyPair = generateKeyPair()
    const tmpPath = join(this.keysDir, `.private.key.${process.pid}.${randomBytes(6).toString('hex')}`)
    await writeFile(tmpPath, keyPair.privateKey, { encoding: 'utf-8', mode: 0o600 })
    await chmod(tmpPath, 0o600)
    try {
      await link(tmpPath, privateKeyPath)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    } finally {
      await unlink(tmpPath).catch(() => {})
    }
    this.privateKey = (await readFile(privateKeyPath, 'utf-8')).trim()
    this.publicKey = getPublicKeyFromPrivate(this.privateKey)

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
