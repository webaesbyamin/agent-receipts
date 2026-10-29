import { readdir, readFile, writeFile, mkdir, stat, rm, realpath } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { createHash } from 'node:crypto'
import type { ActionReceipt, FileManifestEntry } from '@agent-receipts/schema'
import { SqliteReceiptStore, KeyManager, ConfigManager, ReceiptEngine, hashData } from '@agent-receipts/mcp-server'
import { parseRecipe, RECIPE_FILE, RecipeError } from './recipe.js'
import type { Recipe } from './recipe.js'
import type { Executor, ExecResult, JobContext } from './executor.js'
import { listFiles, manifestEntry, moveFile, exists, slug } from './files.js'
import { renderReceiptHtml } from './render.js'
import { cleanSummary, dropNoOpChanges } from './tidy.js'
import { writeChangesReport, CHANGES_FILE } from './changes.js'
import type { Issuer } from './render.js'

export const DONE_DIR = 'Done'
export const APPROVAL_DIR = 'Needs your OK'
export const STATE_DIR = '.magic'
export const NOTE_FILE = 'note.txt'
const WORKING_SUFFIX = ' - working.txt'
const PROBLEM_FILE = 'Recipe problem.txt'
const JOURNAL_FILE = '.job.json'
/** The recipe whose agent-written changes.md lists "before -> after" lines (recipes without changes_report). */
const FIX_TYPOS = 'Fix typos'

/** Names that are never treated as a dropped file. */
const IGNORE = [
  /^\./, /^~\$/, /^Icon\r?$/, /^desktop\.ini$/i, /^Thumbs\.db$/i,
  /\.(crdownload|part|partial|download|tmp)$/i, new RegExp(`${WORKING_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
  new RegExp(`^${PROBLEM_FILE}$`),
]

export interface MagicFolderOptions {
  executor: Executor
  /** Where receipts and the signing key live. Default ~/.agent-receipts/magic-folder (keep it OFF shared drives). */
  dataDir?: string
  issuer?: Issuer
  verifyPageUrl?: string
  /** A drop counts as finished when its size and mtime hold still this long. Default 3000 ms. */
  settleMs?: number
  /** Polling interval for `start()`. Default 2000 ms. */
  pollMs?: number
  timeZone?: string
  onEvent?: (event: MagicFolderEvent) => void
  /** How long past the time limit to wait for an executor that ignores the abort signal. Default 5000 ms. */
  hardStopGraceMs?: number
}

export type MagicFolderEvent =
  | { type: 'job-started'; jobId: string; recipe: string; files: string[] }
  | { type: 'job-finished'; jobId: string; recipe: string; ok: boolean; receiptId: string; destination: string }
  | { type: 'approved'; jobId: string; receiptId: string }
  | { type: 'recipe-error'; recipe: string; message: string }
  | { type: 'recovered'; jobId: string; action: 'delivered' | 'returned' }
  | { type: 'error'; message: string }

export interface JobOutcome {
  jobId: string
  ok: boolean
  receipt: ActionReceipt
  destination: string
}

interface FolderState {
  chain_id: string | null
}

/**
 * Written into each job workspace. It sits in the watched (maybe shared)
 * folder, so recovery treats it as a hint only: every path is rebuilt from
 * the job's folder name and checked to be inside the Magic Folder, and
 * whether the job was signed is looked up in the receipt database.
 */
interface JobJournal {
  jobId: string
  recipe: string
  dropped: string[]
}

export const RESULT_DIR = 'result'
export const ORIGINAL_DIR = 'original'
export const APPROVAL_ACTION = 'magic_folder.approved'
const HARD_STOP_GRACE_MS = 5_000

/** True for a genuine Magic Folder approval of `job`. */
export function isApprovalOf(job: ActionReceipt): (r: ActionReceipt) => boolean {
  return (r) => r.parent_receipt_id === job.receipt_id
    && r.action === APPROVAL_ACTION
    && r.status === 'completed'
    && (r.metadata as { kind?: string }).kind === 'magic_folder_approval'
}

function statusName(dropped: string[]): string {
  return `${basename(dropped.find((n) => n !== NOTE_FILE) ?? dropped[0] ?? 'job')}${WORKING_SUFFIX}`
}

/** "a.txt" -> "a (2).txt" if taken. */
async function freeName(path: string): Promise<string> {
  if (!(await exists(path))) return path
  const dot = path.lastIndexOf('.')
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  const [stem, ext] = dot > slash + 1 ? [path.slice(0, dot), path.slice(dot)] : [path, '']
  for (let i = 2; ; i++) {
    const candidate = `${stem} (${i})${ext}`
    if (!(await exists(candidate))) return candidate
  }
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
    // Its own key by default: agents using the Agent Receipts MCP server can't
    // sign with it, so they can't mint receipts that look like Magic Folder jobs.
    const dataDir = this.options.dataDir ?? join(ConfigManager.getDefaultDataDir(), 'magic-folder')
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
    await this.recoverJobs()
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
    const statusFile = join(recipeDir, statusName(dropped))
    await this.writeJournal(workDir, { jobId, recipe: basename(recipeDir), dropped })

    // 1. Take the drop out of the recipe folder at once, so it can't run twice.
    for (const name of dropped) await moveFile(join(recipeDir, name), join(inputDir, name))
    await writeFile(statusFile, `Working on this now. The result will appear in "${recipe.needsApproval ? APPROVAL_DIR : DONE_DIR}".\n`)
    this.emit({ type: 'job-started', jobId, recipe: recipe.name, files: dropped })

    const inputs: FileManifestEntry[] = []
    for (const name of dropped) inputs.push(await manifestEntry(join(inputDir, name), name, 'input'))
    const noteText = dropped.includes(NOTE_FILE) ? (await readFile(join(inputDir, NOTE_FILE), 'utf-8')).trim() : null

    // 2. Run the agent with a hard time limit: the abort signal fires at the
    //    limit, and if the executor ignores it the job is cut off shortly after.
    const exec = await this.runWithLimit(recipe, {
      jobId, recipe, workDir, inputDir, outputDir, inputFiles: dropped, note: noteText,
    })

    // 3. The harness hashes what actually came out, not what the agent claims.
    let ok = exec.ok
    let error = exec.error
    if (ok && recipe.changesReport) {
      // The runner lists the changes from the files themselves, never the agent.
      await rm(join(outputDir, CHANGES_FILE), { force: true })
      if (!(await writeChangesReport(inputDir, outputDir, dropped.filter((n) => n !== NOTE_FILE)))) {
        ok = false
        error = 'No corrected copy was made.'
      }
    } else if (ok && recipe.name === FIX_TYPOS) {
      // Older Fix typos recipes still have the agent write changes.md.
      for (const name of (await listFiles(outputDir)).filter((n) => basename(n) === CHANGES_FILE)) {
        const path = join(outputDir, name)
        const text = await readFile(path, 'utf-8')
        const tidy = dropNoOpChanges(text)
        if (tidy !== text) await writeFile(path, tidy)
      }
    }
    const outNames = await listFiles(outputDir)
    const outputs: FileManifestEntry[] = []
    for (const name of outNames) outputs.push(await manifestEntry(join(outputDir, name), name, 'output'))
    if (ok && outputs.length === 0) {
      ok = false
      error = 'The agent finished but produced no files.'
    }

    // 4. Sign the receipt.
    const summary = exec.summary ? cleanSummary(exec.summary, [workDir, await realpath(workDir)]) : exec.summary
    const state = await this.readState()
    const recipeHash = `sha256:${createHash('sha256').update(recipe.instruction).digest('hex')}`
    const created = await engine.create({
      action: `magic_folder.${slug(recipe.name)}`,
      // Failed jobs start pending so complete() can sign the failure reason.
      status: ok ? 'completed' : 'pending',
      input_hash: hashData({ recipe: recipe.name, recipe_sha256: recipeHash, inputs }),
      output_hash: ok ? hashData({ outputs, summary }) : null,
      output_summary: ok ? (summary || `Produced ${outputs.length} file${outputs.length === 1 ? '' : 's'}.`) : null,
      model: exec.model,
      tokens_in: exec.tokensIn,
      tokens_out: exec.tokensOut,
      cost_usd: exec.costUsd,
      latency_ms: Date.now() - started,
      tool_calls: exec.toolCalls.length ? exec.toolCalls : null,
      tags: ['magic-folder'],
      files: ok ? [...inputs, ...outputs] : inputs,
      started_at: new Date(started).toISOString(),
      metadata: {
        kind: 'magic_folder_job',
        job_id: jobId,
        recipe: recipe.name,
        recipe_sha256: recipeHash,
        // Failed jobs and jobs that ran on the user's own computer cost nothing
        credits: ok && !exec.local ? recipe.credits : 0,
        needs_approval: ok && recipe.needsApproval,
        cost_is_estimate: !exec.local,
        executor: exec.engine ?? this.options.executor.name,
        ...(exec.local ? { local: true } : {}),
        ...(exec.mode ? { engine_mode: exec.mode } : {}),
        ...(this.options.issuer
          ? { issuer: { name: this.options.issuer.name, ...(this.options.issuer.keyUrl ? { key_url: this.options.issuer.keyUrl } : {}) } }
          : {}),
      },
      ...(state.chain_id ? { chain_id: state.chain_id } : {}),
    })
    const receipt = ok
      ? created
      : await engine.complete(created.receipt_id, {
        status: 'failed',
        error: { message: error ?? 'The job did not finish.' },
        latency_ms: Date.now() - started,
      })
    if (!state.chain_id) {
      state.chain_id = receipt.chain_id
      await this.writeState(state)
    }

    // 5. Deliver. If this is interrupted, the next start finds the signed
    //    receipt by job id and finishes delivery (see recoverJobs).
    const destination = this.destinationFor(receipt, jobId)
    await this.deliver(workDir, receipt, destination, statusFile)

    this.emit({ type: 'job-finished', jobId, recipe: recipe.name, ok, receiptId: receipt.receipt_id, destination })
    return { jobId, ok, receipt, destination }
  }

  private async runWithLimit(recipe: Recipe, job: Omit<JobContext, 'signal'>): Promise<ExecResult> {
    const controller = new AbortController()
    const limitMs = recipe.maxMinutes * 60_000
    const failure = (error: string): ExecResult => ({
      ok: false, summary: '', model: null, tokensIn: null, tokensOut: null, costUsd: null, toolCalls: [], error,
    })
    let abortTimer: NodeJS.Timeout | undefined
    let hardTimer: NodeJS.Timeout | undefined
    const hardStop = new Promise<ExecResult>((done) => {
      abortTimer = setTimeout(() => controller.abort(), limitMs)
      hardTimer = setTimeout(() => done(failure('Stopped: the job ran past its time limit.')), limitMs + (this.options.hardStopGraceMs ?? HARD_STOP_GRACE_MS))
    })
    try {
      const exec = await Promise.race([
        this.options.executor.run({ ...job, signal: controller.signal }).catch((err: unknown) =>
          failure(err instanceof Error ? err.message : String(err))),
        hardStop,
      ])
      return controller.signal.aborted && exec.ok ? { ...exec, ok: false, error: 'Stopped: the job ran past its time limit.' } : exec
    } finally {
      clearTimeout(abortTimer)
      clearTimeout(hardTimer)
    }
  }

  /**
   * Move results into result/, originals into original/, write the receipt.
   * Safe to run again after a crash: it only moves what is still in the job
   * workspace and never overwrites a file.
   */
  private destinationFor(receipt: ActionReceipt, jobId: string): string {
    const needsOk = receipt.status === 'completed' && (receipt.metadata as { needs_approval?: boolean }).needs_approval === true
    return join(this.root, needsOk ? APPROVAL_DIR : DONE_DIR, jobId)
  }

  private async deliver(workDir: string, receipt: ActionReceipt, destination: string, statusFile: string | null): Promise<void> {
    await mkdir(destination, { recursive: true })
    if (receipt.status === 'completed') {
      for (const name of await listFiles(join(workDir, 'output'))) {
        await moveFile(join(workDir, 'output', name), join(destination, RESULT_DIR, name))
      }
    }
    for (const name of await listFiles(join(workDir, 'input'))) {
      await moveFile(join(workDir, 'input', name), join(destination, ORIGINAL_DIR, name))
    }
    await this.writeReceiptFiles(destination, receipt, null)
    if (statusFile) await rm(statusFile, { force: true })
    await rm(workDir, { recursive: true, force: true })
  }

  /** Finish or roll back jobs a crash left in .magic/jobs. */
  private async recoverJobs(): Promise<void> {
    const jobsDir = join(this.root, STATE_DIR, 'jobs')
    for (const e of await readdir(jobsDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      const jobId = e.name
      const workDir = join(jobsDir, jobId)
      const journal = await this.readJournal(workDir)
      // Only a recipe folder directly inside this Magic Folder is accepted.
      const recipeName = journal && typeof journal.recipe === 'string' && !/[\\/]/.test(journal.recipe) && !journal.recipe.startsWith('.')
        ? journal.recipe : null
      const recipeDir = recipeName && (await exists(join(this.root, recipeName, RECIPE_FILE))) ? join(this.root, recipeName) : null
      const dropped = Array.isArray(journal?.dropped) ? journal!.dropped.filter((n) => typeof n === 'string') : []
      const statusFile = recipeDir && dropped.length ? join(recipeDir, statusName(dropped)) : null
      try {
        let receipt = await this.findJobReceipt(jobId)
        if (receipt) {
          if (receipt.status === 'pending') {
            receipt = await this.receipts.complete(receipt.receipt_id, { status: 'failed', error: { message: 'The job was interrupted.' } })
          }
          await this.deliver(workDir, receipt, this.destinationFor(receipt, jobId), statusFile)
          this.emit({ type: 'recovered', jobId, action: 'delivered' })
          continue
        }
        // Never signed: put the drop back where it came from so it runs again.
        if (!recipeDir) {
          this.emit({ type: 'error', message: `Interrupted job ${jobId} could not be returned; its files are in ${workDir}` })
          continue
        }
        for (const name of await listFiles(join(workDir, 'input'))) {
          await moveFile(join(workDir, 'input', name), await freeName(join(recipeDir, basename(name))))
        }
        if (statusFile) await rm(statusFile, { force: true })
        await rm(workDir, { recursive: true, force: true })
        this.emit({ type: 'recovered', jobId, action: 'returned' })
      } catch (err) {
        this.emit({ type: 'error', message: `Recovering ${jobId}: ${err instanceof Error ? err.message : String(err)}` })
      }
    }
  }

  /** The job's receipt in our own database, found by job id (newest first). */
  private async findJobReceipt(jobId: string): Promise<ActionReceipt | null> {
    for (let page = 1; ; page++) {
      const res = await this.receipts.list({ tag: 'magic-folder' }, page, 200, 'timestamp:desc')
      const hit = res.data.find((r) => {
        const m = r.metadata as { kind?: string; job_id?: string }
        return m.kind === 'magic_folder_job' && m.job_id === jobId
      })
      if (hit) return hit
      if (!res.pagination.has_next) return null
    }
  }

  /**
   * Jobs moved from "Needs your OK" into "Done" get a signed approval receipt.
   * Decided from the stored receipt (not the editable receipt.json), and only
   * once per job: the database is checked for an existing approval.
   */
  private async recordApprovals(): Promise<void> {
    const doneRoot = join(this.root, DONE_DIR)
    for (const e of await readdir(doneRoot, { withFileTypes: true })) {
      if (!e.isDirectory()) continue
      const dir = join(doneRoot, e.name)
      const raw = await readFile(join(dir, 'receipt.json'), 'utf-8').catch(() => null)
      if (!raw) continue
      let receiptId: unknown
      try {
        receiptId = (JSON.parse(raw) as { receipt_id?: unknown }).receipt_id
      } catch {
        continue
      }
      if (typeof receiptId !== 'string') continue
      const stored = await this.receipts.get(receiptId)
      if (!stored) continue // not one of ours
      const meta = stored.metadata as { kind?: string; needs_approval?: boolean; job_id?: string }
      if (meta.kind !== 'magic_folder_job' || meta.needs_approval !== true || stored.status !== 'completed') continue
      if (meta.job_id !== e.name) continue // the folder must be this job's own folder

      const children = await this.receipts.list({ parent_receipt_id: stored.receipt_id }, 1, 100)
      const existing = children.data.find(isApprovalOf(stored))
      if (existing) {
        if (!(await exists(join(dir, 'approval-receipt.json')))) await this.writeReceiptFiles(dir, stored, existing)
        continue
      }

      const approval = await this.receipts.create({
        action: APPROVAL_ACTION,
        status: 'completed',
        input_hash: hashData({ approved_receipt_id: stored.receipt_id }),
        output_summary: `Approved by moving the job into ${DONE_DIR}.`,
        parent_receipt_id: stored.receipt_id,
        chain_id: stored.chain_id,
        tags: ['magic-folder'],
        metadata: { kind: 'magic_folder_approval', job_id: meta.job_id, approved_receipt_id: stored.receipt_id },
      })
      await this.writeReceiptFiles(dir, stored, approval)
      this.emit({ type: 'approved', jobId: meta.job_id, receiptId: approval.receipt_id })
    }
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
      return { chain_id: s.chain_id ?? null }
    } catch {
      return { chain_id: null }
    }
  }

  private async writeState(state: FolderState): Promise<void> {
    await mkdir(join(this.root, STATE_DIR), { recursive: true })
    await writeFile(join(this.root, STATE_DIR, 'state.json'), `${JSON.stringify(state, null, 2)}\n`)
  }

  private async writeJournal(workDir: string, journal: JobJournal): Promise<void> {
    await writeFile(join(workDir, JOURNAL_FILE), `${JSON.stringify(journal, null, 2)}\n`)
  }

  private async readJournal(workDir: string): Promise<JobJournal | null> {
    try {
      return JSON.parse(await readFile(join(workDir, JOURNAL_FILE), 'utf-8')) as JobJournal
    } catch {
      return null
    }
  }

  private emit(event: MagicFolderEvent): void {
    this.options.onEvent?.(event)
  }
}

