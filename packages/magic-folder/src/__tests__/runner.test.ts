import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile, readdir, mkdir, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { verifyAnyReceipt, hashReceipt } from '@agent-receipts/crypto'
import type { ActionReceipt } from '@agent-receipts/schema'
import { MagicFolder, DONE_DIR, APPROVAL_DIR, STATE_DIR } from '../runner.js'
import { initMagicFolder } from '../starter.js'
import { RECIPE_FILE, parseRecipe } from '../recipe.js'
import { extractReceiptData } from '../render.js'
import { FakeExecutor, okResult, describeEach } from './helpers.js'
import type { Executor } from '../executor.js'

const sha = (s: string) => `sha256:${createHash('sha256').update(s).digest('hex')}`

describe('MagicFolder runner', () => {
  let root: string
  let dataDir: string
  let mf: MagicFolder | null = null

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'mf-root-'))
    dataDir = await mkdtemp(join(tmpdir(), 'mf-data-'))
    await initMagicFolder(root)
  })

  afterEach(async () => {
    mf?.close()
    mf = null
    await rm(root, { recursive: true, force: true })
    await rm(dataDir, { recursive: true, force: true })
  })

  const open = (executor: Executor, extra: Record<string, unknown> = {}) => {
    mf = new MagicFolder(root, { executor, dataDir, timeZone: 'UTC', ...extra })
    return mf
  }

  const doneJobs = async (base = DONE_DIR) => (await readdir(join(root, base))).sort()

  it('runs a dropped file end to end: result, original, signed receipt', async () => {
    const folder = open(describeEach)
    await writeFile(join(root, 'Write product descriptions', 'sofa.txt'), 'linen sofa, oak legs')

    const [outcome] = await folder.scanOnce({ settle: false })
    expect(outcome!.ok).toBe(true)

    const jobs = await doneJobs()
    expect(jobs).toHaveLength(1)
    const dir = join(root, DONE_DIR, jobs[0]!)
    expect((await readdir(dir)).sort()).toEqual(['original', 'receipt.html', 'receipt.json', 'result'])
    expect(await readFile(join(dir, 'original', 'sofa.txt'), 'utf-8')).toBe('linen sofa, oak legs')
    expect(await readFile(join(dir, 'result', 'sofa.txt - description.md'), 'utf-8')).toContain('LINEN SOFA')

    // The drop left the recipe folder, and no status file is left behind
    expect((await readdir(join(root, 'Write product descriptions'))).filter((n) => !n.startsWith('.'))).toEqual([])
    // The job workspace is cleaned up
    expect(await readdir(join(root, STATE_DIR, 'jobs'))).toEqual([])

    const receipt = JSON.parse(await readFile(join(dir, 'receipt.json'), 'utf-8')) as ActionReceipt
    expect(receipt.sig_version).toBe(2)
    expect(receipt.status).toBe('completed')
    expect(receipt.output_summary).toBe('Wrote one description.')
    expect(receipt.cost_usd).toBe(0.0123)
    expect((receipt.metadata as Record<string, unknown>)['credits']).toBe(1)
    expect((receipt.metadata as Record<string, unknown>)['cost_is_estimate']).toBe(true)
    expect(verifyAnyReceipt(receipt, folder.publicKey, { requireV2: true }).valid).toBe(true)
  })

  it('hashes the real files itself (the manifest matches the bytes on disk)', async () => {
    const folder = open(describeEach)
    await writeFile(join(root, 'Write product descriptions', 'lamp.txt'), 'brass lamp')
    const [outcome] = await folder.scanOnce({ settle: false })
    const files = outcome!.receipt.files!
    const input = files.find((f) => f.role === 'input')!
    const output = files.find((f) => f.role === 'output')!
    expect(input).toEqual({ name: 'lamp.txt', sha256: sha('brass lamp'), bytes: 10, role: 'input' })
    const produced = await readFile(join(outcome!.destination, 'result', output.name), 'utf-8')
    expect(output.sha256).toBe(sha(produced))
  })

  it('a batch dropped together is one job with one receipt', async () => {
    const folder = open(describeEach)
    for (const n of ['a.txt', 'b.txt', 'c.txt']) await writeFile(join(root, 'Write product descriptions', n), n)
    const out = await folder.scanOnce({ settle: false })
    expect(out).toHaveLength(1)
    expect(out[0]!.receipt.files!.filter((f) => f.role === 'input')).toHaveLength(3)
    expect(describeEach.calls.at(-1)!.inputFiles).toEqual(['a.txt', 'b.txt', 'c.txt'])
  })

  it('waits for a drop to settle before starting', async () => {
    const folder = open(describeEach, { settleMs: 50 })
    await writeFile(join(root, 'Fix typos', 'notes.txt'), 'teh cat')
    expect(await folder.scanOnce()).toHaveLength(0) // first sighting
    expect(await folder.scanOnce()).toHaveLength(0) // not settled long enough
    await new Promise((r) => setTimeout(r, 70))
    expect(await folder.scanOnce()).toHaveLength(1)
  })

  it('ignores partial downloads, hidden files and its own status files', async () => {
    const folder = open(describeEach)
    const dir = join(root, 'Fix typos')
    await writeFile(join(dir, 'big.pdf.crdownload'), 'x')
    await writeFile(join(dir, '.DS_Store'), 'x')
    await writeFile(join(dir, '~$draft.docx'), 'x')
    await writeFile(join(dir, 'x.txt - working.txt'), 'x')
    expect(await folder.scanOnce({ settle: false })).toHaveLength(0)
  })

  it('passes note.txt to the agent as the note', async () => {
    const exec = new FakeExecutor(async (job) => {
      await writeFile(join(job.outputDir, 'answer.md'), job.note ?? 'none')
      return okResult()
    })
    const folder = open(exec)
    await writeFile(join(root, 'Ask anything', 'data.csv'), 'a,b\n1,2')
    await writeFile(join(root, 'Ask anything', 'note.txt'), 'Sum column b please')
    const [o] = await folder.scanOnce({ settle: false })
    expect(exec.calls[0]!.note).toBe('Sum column b please')
    expect(await readFile(join(o!.destination, 'result', 'answer.md'), 'utf-8')).toBe('Sum column b please')
    expect((await readdir(join(o!.destination, 'original'))).sort()).toEqual(['data.csv', 'note.txt'])
  })

  it('a failed job: signed failure reason, no credits, original returned, nothing else delivered', async () => {
    const exec = new FakeExecutor(async (job) => {
      await writeFile(join(job.outputDir, 'half.md'), 'partial')
      return { ...okResult(), ok: false, summary: '', error: 'Stopped: the job hit its cost limit.' }
    })
    const folder = open(exec)
    await writeFile(join(root, 'Fix typos', 'essay.txt'), 'hello')
    const [o] = await folder.scanOnce({ settle: false })

    expect(o!.ok).toBe(false)
    const r = o!.receipt
    expect(r.status).toBe('failed')
    expect(r.error).toEqual({ message: 'Stopped: the job hit its cost limit.' })
    expect((r.metadata as Record<string, unknown>)['credits']).toBe(0)
    expect(r.files!.every((f) => f.role === 'input')).toBe(true)
    expect(verifyAnyReceipt(r, folder.publicKey, { requireV2: true }).valid).toBe(true)
    // the failure reason is covered by the signature
    expect(verifyAnyReceipt({ ...r, error: { message: 'All good actually' } }, folder.publicKey).valid).toBe(false)

    expect((await readdir(o!.destination)).sort()).toEqual(['original', 'receipt.html', 'receipt.json'])
    expect(await readFile(join(o!.destination, 'original', 'essay.txt'), 'utf-8')).toBe('hello')
  })

  it('an agent that claims success but writes nothing is a failure', async () => {
    const folder = open(new FakeExecutor(async () => okResult()))
    await writeFile(join(root, 'Fix typos', 'x.txt'), 'x')
    const [o] = await folder.scanOnce({ settle: false })
    expect(o!.ok).toBe(false)
    expect(o!.receipt.error).toEqual({ message: 'The agent finished but produced no files.' })
  })

  it('an executor that throws is a failure, not a crash', async () => {
    const folder = open(new FakeExecutor(async () => { throw new Error('network down') }))
    await writeFile(join(root, 'Fix typos', 'x.txt'), 'x')
    const [o] = await folder.scanOnce({ settle: false })
    expect(o!.receipt.status).toBe('failed')
    expect(o!.receipt.error).toEqual({ message: 'network down' })
  })

  it('enforces the time limit', async () => {
    const slow = new FakeExecutor((job) => new Promise((done) => {
      job.signal.addEventListener('abort', () => done({ ...okResult(), ok: false, error: 'aborted' }))
    }))
    const folder = open(slow)
    await folder.init()
    const recipe = { ...parseRecipe('Fix typos', 'Fix.'), maxMinutes: 0.0005 } // 30 ms
    await mkdir(join(root, 'Fix typos'), { recursive: true })
    await writeFile(join(root, 'Fix typos', 'x.txt'), 'x')
    const o = await folder.runJob(recipe, join(root, 'Fix typos'), ['x.txt'])
    expect(o.ok).toBe(false)
  })

  it('a hard stop cuts off an executor that ignores the time limit', async () => {
    const stubborn = new FakeExecutor(() => new Promise(() => { /* never resolves */ }))
    const folder = open(stubborn, { hardStopGraceMs: 20 })
    await folder.init()
    const recipe = { ...parseRecipe('Fix typos', 'Fix.'), maxMinutes: 0.0005 }
    await writeFile(join(root, 'Fix typos', 'x.txt'), 'x')
    const o = await folder.runJob(recipe, join(root, 'Fix typos'), ['x.txt'])
    expect(o.ok).toBe(false)
    expect(o.receipt.error).toEqual({ message: 'Stopped: the job ran past its time limit.' })
  })

  it("agent output can't collide with the original, the receipt or each other", async () => {
    const exec = new FakeExecutor(async (job) => {
      await writeFile(join(job.outputDir, 'original'), 'agent file named original')
      await writeFile(join(job.outputDir, 'receipt.html'), 'fake receipt')
      await writeFile(join(job.outputDir, 'x.txt'), 'agent copy')
      return okResult()
    })
    const folder = open(exec)
    await writeFile(join(root, 'Fix typos', 'x.txt'), 'USER ORIGINAL')
    const [o] = await folder.scanOnce({ settle: false })
    expect(o!.ok).toBe(true)
    expect(await readFile(join(o!.destination, 'original', 'x.txt'), 'utf-8')).toBe('USER ORIGINAL')
    expect(await readFile(join(o!.destination, 'result', 'x.txt'), 'utf-8')).toBe('agent copy')
    expect(await readFile(join(o!.destination, 'result', 'receipt.html'), 'utf-8')).toBe('fake receipt')
    expect(extractReceiptData(await readFile(join(o!.destination, 'receipt.html'), 'utf-8'))).not.toBeNull()
    for (const f of o!.receipt.files!.filter((x) => x.role === 'output')) {
      expect(sha(await readFile(join(o!.destination, 'result', f.name), 'utf-8'))).toBe(f.sha256)
    }
  })

  it('recovers a job interrupted before signing: the drop goes back to run again', async () => {
    const folder = open(describeEach)
    await folder.init()
    folder.close()
    mf = null
    const work = join(root, STATE_DIR, 'jobs', '2026-01-01 0000 lost')
    await mkdir(join(work, 'input'), { recursive: true })
    await writeFile(join(work, 'input', 'lost.txt'), 'precious')
    await writeFile(join(root, 'Fix typos', 'lost.txt - working.txt'), 'working')
    await writeFile(join(work, '.job.json'), JSON.stringify({ jobId: '2026-01-01 0000 lost', recipe: 'Fix typos', dropped: ['lost.txt'] }))

    const events: string[] = []
    const again = open(describeEach, { onEvent: (e: { type: string }) => events.push(e.type) })
    await again.init()
    expect(events).toContain('recovered')
    expect(await readFile(join(root, 'Fix typos', 'lost.txt'), 'utf-8')).toBe('precious')
    expect(await readdir(join(root, 'Fix typos'))).not.toContain('lost.txt - working.txt')
    expect(await readdir(join(root, STATE_DIR, 'jobs'))).toEqual([])
    const [o] = await again.scanOnce({ settle: false })
    expect(o!.ok).toBe(true)
  })

  it('recovers a job interrupted after signing: delivery is finished', async () => {
    const folder = open(describeEach)
    await folder.init()
    // Crash right after signing, before delivery: only the database knows
    const receipt = await folder.receipts.create({ action: 'magic_folder.fix-typos', status: 'completed', input_hash: 'sha256:1', tags: ['magic-folder'], metadata: { kind: 'magic_folder_job', job_id: 'j1', recipe: 'Fix typos', credits: 1 } })
    folder.close()
    mf = null
    const work = join(root, STATE_DIR, 'jobs', 'j1')
    await mkdir(join(work, 'input'), { recursive: true })
    await mkdir(join(work, 'output'), { recursive: true })
    await writeFile(join(work, 'input', 'a.txt'), 'in')
    await writeFile(join(work, 'output', 'a-fixed.txt'), 'out')
    const destination = join(root, DONE_DIR, 'j1')
    await writeFile(join(work, '.job.json'), JSON.stringify({ jobId: 'j1', recipe: 'Fix typos', dropped: ['a.txt'] }))

    const again = open(describeEach)
    await again.init()
    expect(await readFile(join(destination, 'original', 'a.txt'), 'utf-8')).toBe('in')
    expect(await readFile(join(destination, 'result', 'a-fixed.txt'), 'utf-8')).toBe('out')
    expect(JSON.parse(await readFile(join(destination, 'receipt.json'), 'utf-8')).receipt_id).toBe(receipt.receipt_id)
    expect(await readdir(join(root, STATE_DIR, 'jobs'))).toEqual([])
  })

  it('a crafted job journal cannot touch files outside the Magic Folder', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'mf-outside-'))
    try {
      await writeFile(join(outside, 'victim.txt'), 'keep me')
      const folder = open(describeEach)
      await folder.init()
      folder.close()
      mf = null
      const work = join(root, STATE_DIR, 'jobs', 'evil')
      await mkdir(join(work, 'input'), { recursive: true })
      await writeFile(join(work, 'input', 'payload.sh'), 'rm -rf /')
      await writeFile(join(work, '.job.json'), JSON.stringify({
        jobId: 'evil', recipe: '../../' + outside, dropped: ['victim.txt'],
        recipeDir: outside, statusFile: join(outside, 'victim.txt'), phase: 'signed', destination: outside,
      }))
      await open(describeEach).init()
      expect(await readFile(join(outside, 'victim.txt'), 'utf-8')).toBe('keep me')
      expect((await readdir(outside)).sort()).toEqual(['victim.txt'])
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })

  it('a job whose failure was signed pending is closed out as failed on recovery', async () => {
    const folder = open(describeEach)
    await folder.init()
    await folder.receipts.create({ action: 'magic_folder.fix-typos', input_hash: 'sha256:1', tags: ['magic-folder'], metadata: { kind: 'magic_folder_job', job_id: 'j2', recipe: 'Fix typos', credits: 0 } })
    folder.close()
    mf = null
    const work = join(root, STATE_DIR, 'jobs', 'j2')
    await mkdir(join(work, 'input'), { recursive: true })
    await writeFile(join(work, 'input', 'b.txt'), 'b')
    await writeFile(join(work, '.job.json'), JSON.stringify({ jobId: 'j2', recipe: 'Fix typos', dropped: ['b.txt'] }))
    await open(describeEach).init()
    const r = JSON.parse(await readFile(join(root, DONE_DIR, 'j2', 'receipt.json'), 'utf-8'))
    expect(r.status).toBe('failed')
    expect(r.error).toEqual({ message: 'The job was interrupted.' })
    expect(await readFile(join(root, DONE_DIR, 'j2', 'original', 'b.txt'), 'utf-8')).toBe('b')
  })

  it('editing receipt.json cannot conjure an approval, and approvals are never duplicated', async () => {
    const folder = open(describeEach)
    await writeFile(join(root, 'Fix typos', 'x.txt'), 'x')
    const [o] = await folder.scanOnce({ settle: false })
    // Flip needs_approval in the editable copy of a job that never needed it
    const path = join(o!.destination, 'receipt.json')
    const edited = JSON.parse(await readFile(path, 'utf-8'))
    edited.metadata.needs_approval = true
    await writeFile(path, JSON.stringify(edited))
    await folder.scanOnce({ settle: false })
    const children = await folder.receipts.list({ parent_receipt_id: o!.receipt.receipt_id })
    expect(children.data).toHaveLength(0)
  })

  it('approval: job waits in "Needs your OK", moving it to Done signs an approval', async () => {
    const exec = new FakeExecutor(async (job) => {
      await writeFile(join(job.outputDir, 'email.md'), 'Subject: Update')
      return okResult({ summary: 'Drafted the email.' })
    })
    const folder = open(exec)
    await writeFile(join(root, 'Draft a client email', 'notes.txt'), 'tell them launch moved')
    const [o] = await folder.scanOnce({ settle: false })
    expect(o!.destination).toContain(APPROVAL_DIR)
    let html = await readFile(join(o!.destination, 'receipt.html'), 'utf-8')
    expect(extractReceiptData(html)!.approval).toBeNull()
    expect((o!.receipt.metadata as Record<string, unknown>)['needs_approval']).toBe(true)

    const jobName = (await doneJobs(APPROVAL_DIR))[0]!
    await rename(join(root, APPROVAL_DIR, jobName), join(root, DONE_DIR, jobName))
    await folder.scanOnce({ settle: false })

    const dir = join(root, DONE_DIR, jobName)
    const approval = JSON.parse(await readFile(join(dir, 'approval-receipt.json'), 'utf-8')) as ActionReceipt
    expect(approval.parent_receipt_id).toBe(o!.receipt.receipt_id)
    expect(approval.action).toBe('magic_folder.approved')
    expect(verifyAnyReceipt(approval, folder.publicKey, { requireV2: true }).valid).toBe(true)
    html = await readFile(join(dir, 'receipt.html'), 'utf-8')
    expect(extractReceiptData(html)!.approval!.receipt_id).toBe(approval.receipt_id)

    // only once, even if the folder's state file is lost
    await rm(join(root, STATE_DIR, 'state.json'), { force: true })
    await folder.scanOnce({ settle: false })
    const chain = await folder.receipts.getChain(o!.receipt.chain_id)
    expect(chain.filter((r) => r.action === 'magic_folder.approved')).toHaveLength(1)
  })

  it('all jobs in a folder form one verifiable chain', async () => {
    const folder = open(describeEach)
    await writeFile(join(root, 'Fix typos', 'one.txt'), '1')
    const [a] = await folder.scanOnce({ settle: false })
    await writeFile(join(root, 'Fix typos', 'two.txt'), '2')
    const [b] = await folder.scanOnce({ settle: false })
    expect(b!.receipt.chain_id).toBe(a!.receipt.chain_id)
    expect(b!.receipt.prev_receipt_hash).toBe(hashReceipt(a!.receipt))
    const v = await folder.receipts.verifyChain(a!.receipt.chain_id)
    expect(v.valid).toBe(true)
  })

  it('a broken recipe stops that folder and says why, other folders still run', async () => {
    await writeFile(join(root, 'Fix typos', RECIPE_FILE), '---\ntools: Bash\n---\nrun stuff')
    const events: string[] = []
    const folder = open(describeEach, { onEvent: (e: { type: string }) => events.push(e.type) })
    await writeFile(join(root, 'Fix typos', 'x.txt'), 'x')
    await writeFile(join(root, 'Meeting notes to tasks', 'notes.txt'), 'n')
    const out = await folder.scanOnce({ settle: false })
    expect(out).toHaveLength(1)
    expect(events).toContain('recipe-error')
    expect(await readFile(join(root, 'Fix typos', 'Recipe problem.txt'), 'utf-8')).toContain('Bash')
    expect(await readdir(join(root, 'Fix typos'))).toContain('x.txt') // untouched
  })

  it('never processes the same drop twice', async () => {
    const folder = open(describeEach)
    await writeFile(join(root, 'Fix typos', 'x.txt'), 'x')
    await folder.scanOnce({ settle: false })
    expect(await folder.scanOnce({ settle: false })).toHaveLength(0)
    expect(await doneJobs()).toHaveLength(1)
  })

  it('job folders get readable, unique names', async () => {
    const folder = open(describeEach)
    await writeFile(join(root, 'Fix typos', 'My Sofa (Final).TXT'), 'x')
    await folder.scanOnce({ settle: false })
    await writeFile(join(root, 'Fix typos', 'My Sofa (Final).TXT'), 'y')
    await folder.scanOnce({ settle: false })
    const jobs = await doneJobs()
    expect(jobs).toHaveLength(2)
    expect(jobs[0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{4} my-sofa-final( 2)?$/)
    expect(new Set(jobs).size).toBe(2)
  })

  it('the delivered receipt.html carries the signed receipt and verifies', async () => {
    const folder = open(describeEach, { issuer: { name: 'Webaes', keyUrl: 'https://webaes.com/.well-known/agent-receipts.json' } })
    await writeFile(join(root, 'Fix typos', 'x.txt'), 'x')
    const [o] = await folder.scanOnce({ settle: false })
    const html = await readFile(join(o!.destination, 'receipt.html'), 'utf-8')
    const data = extractReceiptData(html)!
    expect(data.receipt).toEqual(o!.receipt)
    expect(data.publicKey).toBe(folder.publicKey)
    expect((data.receipt.metadata as Record<string, unknown>)['issuer']).toEqual({ name: 'Webaes', key_url: 'https://webaes.com/.well-known/agent-receipts.json' })
    expect(verifyAnyReceipt(data.receipt, data.publicKey, { requireV2: true }).valid).toBe(true)
  })
})
