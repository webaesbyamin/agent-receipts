import { createHash } from 'node:crypto'
import { createReadStream, constants as fsConstants } from 'node:fs'
import { readdir, stat, mkdir, rename, copyFile, rm } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import type { FileManifestEntry } from '@agent-receipts/schema'

/** Hash a file on disk. The harness does this — never the agent. */
export async function hashFile(path: string): Promise<{ sha256: string; bytes: number }> {
  const hash = createHash('sha256')
  let bytes = 0
  await new Promise<void>((resolve, reject) => {
    createReadStream(path)
      .on('data', (chunk) => {
        const b = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
        bytes += b.length
        hash.update(b)
      })
      .on('end', () => resolve())
      .on('error', reject)
  })
  return { sha256: `sha256:${hash.digest('hex')}`, bytes }
}

export async function manifestEntry(path: string, name: string, role: 'input' | 'output'): Promise<FileManifestEntry> {
  const { sha256, bytes } = await hashFile(path)
  return { name, sha256, bytes, role }
}

/** All regular files under dir (recursive), as paths relative to dir with `/` separators. Skips dotfiles. */
export async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(d: string): Promise<void> {
    let entries
    try {
      entries = await readdir(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const full = join(d, e.name)
      if (e.isDirectory()) await walk(full)
      else if (e.isFile()) out.push(relative(dir, full).split(sep).join('/'))
    }
  }
  await walk(dir)
  return out.sort()
}

/**
 * Move a file, falling back to copy + delete across devices (e.g. a synced
 * Drive folder). Never overwrites: if `to` exists it throws, so nobody's file
 * is silently replaced.
 */
export async function moveFile(from: string, to: string): Promise<void> {
  await mkdir(join(to, '..'), { recursive: true })
  if (await exists(to)) throw new Error(`Refusing to overwrite ${to}`)
  try {
    await whenUnlocked(() => rename(from, to))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err
    await copyFile(from, to, fsConstants.COPYFILE_EXCL)
    await whenUnlocked(() => rm(from))
  }
}

/** Delete a file or folder, waiting out brief locks. */
export async function remove(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
}

/** Error codes for a file that's briefly open elsewhere (Windows: antivirus, indexer, sync). */
const LOCKED = new Set(['EBUSY', 'EPERM', 'EACCES'])

/**
 * Windows can't rename or delete a file another program has open, and
 * antivirus or a sync client often has a new file open for a moment.
 * Retry for up to ~2 s before giving up.
 */
export async function whenUnlocked<T>(fn: () => Promise<T>, tries = 20, delayMs = 100): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i >= tries || !LOCKED.has((err as NodeJS.ErrnoException).code ?? '')) throw err
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** "Sofa photo (final).JPG" -> "sofa-photo-final" */
export function slug(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  const s = base.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s.slice(0, 40) || 'file'
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
