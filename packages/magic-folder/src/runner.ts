import { readdir, readFile, writeFile, mkdir, stat, rm } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { createHash } from 'node:crypto'
import type { ActionReceipt, FileManifestEntry } from '@agent-receipts/schema'
import { SqliteReceiptStore, KeyManager, ConfigManager, ReceiptEngine, hashData } from '@agent-receipts/mcp-server'
import { parseRecipe, RECIPE_FILE, RecipeError } from './recipe.js'
import type { Recipe } from './recipe.js'
import type { Executor, ExecResult } from './executor.js'
import { listFiles, manifestEntry, moveFile, exists, slug } from './files.js'
import { renderReceiptHtml } from './render.js'
import type { Issuer } from './render.js'

export const DONE_DIR = 'Done'
export const APPROVAL_DIR = 'Needs your OK'
export const STATE_DIR = '.magic'
export const NOTE_FILE = 'note.txt'
const WORKING_SUFFIX = ' - working.txt'
const PROBLEM_FILE = 'Recipe problem.txt'

/** Names that are never treated as a dropped file. */
const IGNORE = [
  /^\./, /^~\$/, /^Icon\r?$/, /^desktop\.ini$/i, /^Thumbs\.db$/i,
  /\.(crdownload|part|partial|download|tmp)$/i, new RegExp(`${WORKING_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
  new RegExp(`^${PROBLEM_FILE}$`),
]

export interface MagicFolderOptions {
  executor: Executor
  /** Where receipts and the signing key live. Default ~/.agent-receipts (keep it OFF shared drives). */
  dataDir?: string
  issuer?: Issuer
  verifyPageUrl?: string
  /** A drop counts as finished when its size and mtime hold still this long. Default 3000 ms. */
  settleMs?: number
  /** Polling interval for `start()`. Default 2000 ms. */
  pollMs?: number
  timeZone?: string
  onEvent?: (event: MagicFolderEvent) => void
}

export type MagicFolderEvent =
  | { type: 'job-started'; jobId: string; recipe: string; files: string[] }
  | { type: 'job-finished'; jobId: string; recipe: string; ok: boolean; receiptId: string; destination: string }
  | { type: 'approved'; jobId: string; receiptId: string }
  | { type: 'recipe-error'; recipe: string; message: string }
  | { type: 'error'; message: string }

export interface JobOutcome {
  jobId: string
  ok: boolean
  receipt: ActionReceipt
  destination: string
}

interface FolderState {
  chain_id: string | null
  approved: string[]
}

interface Seen { size: number; mtimeMs: number; since: number }

export class MagicFolder {
  private engine: ReceiptEngine | null = null
  private keyManager: KeyManager | null = null
  private store: SqliteReceiptStore | null = null
  private seen = new Map<string, Seen>()
  private timer: NodeJS.Timeout | null = null
  private busy = false

  constructor(readonly root: string, private readonly options: MagicFolderOptions) {}

  /** Open the receipt store and make sure the folder has its Done / Needs your OK / .magic parts. */
  async init(): Promise<void> {
    if (this.engine) return
    const dataDir = this.options.dataDir ?? ConfigManager.getDefaultDataDir()
    this.store = new SqliteReceiptStore(dataDir)
    await this.store.init()
    this.keyManager = new KeyManager(dataDir)
    await this.keyManager.init()
    const config = new ConfigManager(dataDir)
    await config.init()
    this.engine = new ReceiptEngine(this.store, this.keyManager, config)
    for (const d of [DONE_DIR, APPROVAL_DIR, join(STATE_DIR, 'jobs')]) {
      await mkdir(join(this.root, d), { recursive: true })
    }
  }

  get publicKey(): string {
    if (!this.keyManager) throw new Error('MagicFolder.init() first')
    return this.keyManager.getPublicKey()
  }

  get receipts(): ReceiptEngine {
    if (!this.engine) throw new Error('MagicFolder.init() first')
    return this.engine
  }

  /** Poll forever until stop(). */
  async start(): Promise<void> {
    await this.init()
    const tick = async () => {
      if (this.busy) return
      this.busy = true
      try {
        await this.scanOnce()
      } catch (err) {
        this.emit({ type: 'error', message: err instanceof Error ? err.message : String(err) })
      } finally {
        this.busy = false
      }
    }
    await tick()
    this.timer = setInterval(tick, this.options.pollMs ?? 2000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Close the receipt database. */
  close(): void {
    this.stop()
    this.store?.getDb().close()
  }

  /**
   * One pass: start a job for every recipe folder whose drops have settled,
   * then record approvals for jobs moved from "Needs your OK" into "Done".
   * With `{ settle: false }` every file present counts as settled (CLI --once, tests).
   */
  async scanOnce(opts: { settle?: boolean } = {}): Promise<JobOutcome[]> {
    await this.init()
    const settle = opts.settle ?? true
    const outcomes: JobOutcome[] = []

    for (const folder of await this.recipeFolders()) {
      const dir = join(this.root, folder)
      let recipe: Recipe
      try {
        recipe = parseRecipe(folder, await readFile(join(dir, RECIPE_FILE), 'utf-8'))
        await rm(join(dir, PROBLEM_FILE), { force: true })
      } catch (err) {
        const message = err instanceof RecipeError ? err.message : `${folder}: ${String(err)}`
        await writeFile(join(dir, PROBLEM_FILE), `This folder's recipe has a problem, so files here are not being processed.\n\n${message}\n`)
        this.emit({ type: 'recipe-error', recipe: folder, message })
        continue
      }

      const drops = await this.settledDrops(dir, settle)
      if (drops === null || drops.length === 0) continue
      outcomes.push(await this.runJob(recipe, dir, drops))
    }

    await this.recordApprovals()
    return outcomes
  }

  private async recipeFolders(): Promise<string[]> {
    const entries = await readdir(this.root, { withFileTypes: true })
    const out: string[] = []
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || e.name === DONE_DIR || e.name === APPROVAL_DIR) continue
      if (await exists(join(this.root, e.name, RECIPE_FILE))) out.push(e.name)
    }
    return out.sort()
  }

  /**
   * Files in a recipe folder that are ready. Returns null while anything in
   * the folder is still changing, so a batch dropped together runs together.
   */
  private async settledDrops(dir: string, settle: boolean): Promise<string[] | null> {
    const names = (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isFile() && !IGNORE.some((re) => re.test(e.name)))
      .map((e) => e.name)
      .sort()
    if (!settle) return names

    const now = Date.now()
    const settleMs = this.options.settleMs ?? 3000
    let allSettled = true
    for (const name of names) {
      const path = join(dir, name)
      const s = await stat(path)
      const prev = this.seen.get(path)
      if (!prev || prev.size !== s.size || prev.mtimeMs !== s.mtimeMs) {
        this.seen.set(path, { size: s.size, mtimeMs: s.mtimeMs, since: now })
        allSettled = false
      } else if (now - prev.since < settleMs) {
        allSettled = false
      }
    }
    if (!allSettled) return null
    for (const name of names) this.seen.delete(join(dir, name))
    return names
  }

  /** Run one job: isolate the drop, run the agent, hash everything, sign, deliver. */
  async runJob(recipe: Recipe, recipeDir: string, dropped: string[]): Promise<JobOutcome> {
    const engine = this.receipts
    const started = Date.now()
    const jobId = await this.newJobId(dropped)
    const workDir = join(this.root, STATE_DIR, 'jobs', jobId)
    const inputDir = join(workDir, 'input')
    const outputDir = join(workDir, 'output')
    await mkdir(inputDir, { recursive: true })
    await mkdir(outputDir, { recursive: true })

    // 1. Take the drop out of the recipe folder at once, so it can't run twice.
    for (const name of dropped) await moveFile(join(recipeDir, name), join(inputDir, name))
    const statusFile = join(recipeDir, `${dropped.find((n) => n !== NOTE_FILE) ?? dropped[0]}${WORKING_SUFFIX}`)
    await writeFile(statusFile, `Working on this now. The result will appear in "${recipe.needsApproval ? APPROVAL_DIR : DONE_DIR}".\n`)
    this.emit({ type: 'job-started', jobId, recipe: recipe.name, files: dropped })

    const inputs: FileManifestEntry[] = []
    for (const name of dropped) inputs.push(await manifestEntry(join(inputDir, name), name, 'input'))
    const noteText = dropped.includes(NOTE_FILE) ? (await readFile(join(inputDir, NOTE_FILE), 'utf-8')).trim() : null

    // 2. Run the agent with a hard time limit.
    const controller = new AbortController()
    const limit = setTimeout(() => controller.abort(), recipe.maxMinutes * 60_000)
    let exec: ExecResult
    try {
      exec = await this.options.executor.run({
        jobId, recipe, workDir, inputDir, outputDir,
        inputFiles: dropped, note: noteText, signal: controller.signal,
      })
    } catch (err) {
      exec = {
        ok: false, summary: '', model: null, tokensIn: null, tokensOut: null, costUsd: null, toolCalls: [],
        error: err instanceof Error ? err.message : String(err),
      }
    } finally {
      clearTimeout(limit)
    }
    if (controller.signal.aborted && exec.ok) {
      exec = { ...exec, ok: false, error: 'Stopped: the job ran past its time limit.' }
    }

    // 3. The harness hashes what actually came out — not what the agent claims.
    const outNames = await listFiles(outputDir)
    const outputs: FileManifestEntry[] = []
    for (const name of outNames) outputs.push(await manifestEntry(join(outputDir, name), name, 'output'))
    let ok = exec.ok
    let error = exec.error
    if (ok && outputs.length === 0) {
      ok = false
      error = 'The agent finished but produced no files.'
    }

    // 4. Sign the receipt.
    const state = await this.readState()
    const recipeHash = `sha256:${createHash('sha256').update(recipe.instruction).digest('hex')}`
    const created = await engine.create({
      action: `magic_folder.${slug(recipe.name)}`,
      // Failed jobs start pending so complete() can sign the failure reason.
      status: ok ? 'completed' : 'pending',
      input_hash: hashData({ recipe: recipe.name, recipe_sha256: recipeHash, inputs }),
      output_hash: ok ? hashData({ outputs, summary: exec.summary }) : null,
      output_summary: ok ? (exec.summary || `Produced ${outputs.length} file${outputs.length === 1 ? '' : 's'}.`) : null,
      model: exec.model,
      tokens_in: exec.tokensIn,
      tokens_out: exec.tokensOut,
      cost_usd: exec.costUsd,
      latency_ms: Date.now() - started,
      tool_calls: exec.toolCalls.length ? exec.toolCalls : null,
      tags: ['magic-folder'],
      files: ok ? [...inputs, ...outputs] : inputs,
      metadata: {
        kind: 'magic_folder_job',
        job_id: jobId,
        recipe: recipe.name,
        recipe_sha256: recipeHash,
        credits: ok ? recipe.credits : 0,
        needs_approval: ok && recipe.needsApproval,
        cost_is_estimate: true,
        executor: this.options.executor.name,
        ...(this.options.issuer
          ? { issuer: { name: this.options.issuer.name, ...(this.options.issuer.keyUrl ? { key_url: this.options.issuer.keyUrl } : {}) } }
          : {}),
      },
      ...(state.chain_id ? { chain_id: state.chain_id } : {}),
    })
    const finalReceipt = ok
      ? created
      : await engine.complete(created.receipt_id, {
        status: 'failed',
        error: { message: error ?? 'The job did not finish.' },
        latency_ms: Date.now() - started,
      })
    if (!state.chain_id) {
      state.chain_id = finalReceipt.chain_id
      await this.writeState(state)
    }

    // 5. Deliver: results + untouched originals + receipt.
    const destBase = ok && recipe.needsApproval ? APPROVAL_DIR : DONE_DIR
    const destination = join(this.root, destBase, jobId)
    await mkdir(destination, { recursive: true })
    if (ok) for (const name of outNames) await moveFile(join(outputDir, name), join(destination, name))
    for (const name of dropped) await moveFile(join(inputDir, name), join(destination, 'original', name))
    await this.writeReceiptFiles(destination, finalReceipt, null)
    await rm(statusFile, { force: true })
    await rm(workDir, { recursive: true, force: true })

    this.emit({ type: 'job-finished', jobId, recipe: recipe.name, ok, receiptId: finalReceipt.receipt_id, destination })
    return { jobId, ok, receipt: finalReceipt, destination }
  }

  /** Jobs moved from "Needs your OK" into "Done" get a signed approval receipt. */
  private async recordApprovals(): Promise<void> {
    const state = await this.readState()
    const doneRoot = join(this.root, DONE_DIR)
    let changed = false
    for (const e of await readdir(doneRoot, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      const dir = join(doneRoot, e.name)
      const raw = await readFile(join(dir, 'receipt.json'), 'utf-8').catch(() => null)
      if (!raw) continue
      let receipt: ActionReceipt
      try {
        receipt = JSON.parse(raw) as ActionReceipt
      } catch {
        continue
      }
      const meta = receipt.metadata as { needs_approval?: boolean; job_id?: string }
      if (!meta.needs_approval || state.approved.includes(receipt.receipt_id)) continue
      const stored = await this.receipts.get(receipt.receipt_id)
      if (!stored) continue // not one of ours

      const approval = await this.receipts.create({
        action: 'magic_folder.approved',
        status: 'completed',
        input_hash: hashData({ approved_receipt_id: stored.receipt_id }),
        output_summary: `Approved by moving the job into ${DONE_DIR}.`,
        parent_receipt_id: stored.receipt_id,
        chain_id: stored.chain_id,
        tags: ['magic-folder'],
        metadata: { kind: 'magic_folder_approval', job_id: meta.job_id },
      })
      await this.writeReceiptFiles(dir, stored, approval)
      state.approved.push(stored.receipt_id)
      changed = true
      this.emit({ type: 'approved', jobId: meta.job_id ?? e.name, receiptId: approval.receipt_id })
    }
    if (changed) await this.writeState(state)
  }

  private async writeReceiptFiles(dir: string, receipt: ActionReceipt, approval: ActionReceipt | null): Promise<void> {
    await writeFile(join(dir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`)
    if (approval) await writeFile(join(dir, 'approval-receipt.json'), `${JSON.stringify(approval, null, 2)}\n`)
    const html = renderReceiptHtml(receipt, {
      publicKey: this.publicKey,
      verifyPageUrl: this.options.verifyPageUrl,
      approval,
      timeZone: this.options.timeZone,
    })
    await writeFile(join(dir, 'receipt.html'), html)
  }

  private async newJobId(dropped: string[]): Promise<string> {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${pad(d.getMinutes())}`
    const first = dropped.find((n) => n !== NOTE_FILE) ?? dropped[0] ?? 'job'
    const base = `${stamp} ${slug(basename(first))}`
    let id = base
    for (let i = 2; await this.jobIdTaken(id); i++) id = `${base} ${i}`
    return id
  }

  private async jobIdTaken(id: string): Promise<boolean> {
    return (await exists(join(this.root, DONE_DIR, id)))
      || (await exists(join(this.root, APPROVAL_DIR, id)))
      || (await exists(join(this.root, STATE_DIR, 'jobs', id)))
  }

  private async readState(): Promise<FolderState> {
    try {
      const s = JSON.parse(await readFile(join(this.root, STATE_DIR, 'state.json'), 'utf-8')) as Partial<FolderState>
      return { chain_id: s.chain_id ?? null, approved: Array.isArray(s.approved) ? s.approved : [] }
    } catch {
      return { chain_id: null, approved: [] }
    }
  }

  private async writeState(state: FolderState): Promise<void> {
    await mkdir(join(this.root, STATE_DIR), { recursive: true })
    await writeFile(join(this.root, STATE_DIR, 'state.json'), `${JSON.stringify(state, null, 2)}\n`)
  }

  private emit(event: MagicFolderEvent): void {
    this.options.onEvent?.(event)
  }
}

