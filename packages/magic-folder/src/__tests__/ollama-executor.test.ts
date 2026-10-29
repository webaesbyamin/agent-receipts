import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OllamaExecutor, safeFileName } from '../ollama-executor.js'
import { EngineRouter } from '../engines.js'
import { parseRecipe, RecipeError } from '../recipe.js'
import type { JobContext } from '../executor.js'
import { MagicFolder } from '../runner.js'
import { initMagicFolder } from '../starter.js'
import { extractReceiptData } from '../render.js'
import { FakeExecutor, okResult } from './helpers.js'

type Handler = (path: string, body: Record<string, unknown>) => { status?: number; json: unknown }

/** A stand-in Ollama server speaking the documented /api shapes. */
async function fakeOllama(handler: Handler) {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = []
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {}
      requests.push({ path: req.url ?? '', body })
      const out = handler(req.url ?? '', body)
      res.writeHead(out.status ?? 200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(out.json))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const host = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { host, requests, close: () => new Promise<void>((r) => server.close(() => r())) }
}

const chatReply = (message: Record<string, unknown>, counts = { prompt_eval_count: 100, eval_count: 20 }) =>
  ({ json: { model: 'test-model', message: { role: 'assistant', content: '', ...message }, done: true, done_reason: 'stop', ...counts } })

describe('OllamaExecutor', () => {
  let work: string
  let job: JobContext
  let closers: Array<() => Promise<void>> = []

  beforeEach(async () => {
    work = await mkdtemp(join(tmpdir(), 'mf-ollama-'))
    await mkdir(join(work, 'input'), { recursive: true })
    await mkdir(join(work, 'output'), { recursive: true })
    await writeFile(join(work, 'input', 'sofa.txt'), 'Linen sofa, oak legs, 210 cm.')
    job = {
      jobId: 'j1',
      recipe: parseRecipe('Write product descriptions', '---\ntools: Read, Write\nmodel: test-model\n---\nDescribe each product.'),
      workDir: work, inputDir: join(work, 'input'), outputDir: join(work, 'output'),
      inputFiles: ['sofa.txt'], note: null, signal: new AbortController().signal,
    }
  })

  afterEach(async () => {
    for (const c of closers) await c()
    closers = []
    await rm(work, { recursive: true, force: true })
  })

  const serve = async (h: Handler) => { const s = await fakeOllama(h); closers.push(s.close); return s }

  it("says plainly when Ollama isn't running", async () => {
    const r = await new OllamaExecutor({ host: 'http://127.0.0.1:1' }).run(job)
    expect(r.ok).toBe(false)
    expect(r.error).toContain("Ollama isn't running")
  })

  it('says which model to pull when it is missing', async () => {
    const s = await serve(() => ({ status: 404, json: { error: "model 'test-model' not found" } }))
    const r = await new OllamaExecutor({ host: s.host }).run(job)
    expect(r.error).toBe("The model test-model isn't installed. Run: ollama pull test-model")
  })

  it('json mode: files in the prompt, schema-shaped answer, safe file names', async () => {
    const s = await serve((path) => path === '/api/show'
      ? { json: { capabilities: ['completion'] } }
      : chatReply({ content: JSON.stringify({
        summary: 'Wrote one description.',
        files: [
          { name: '../../escape.md', content: 'trying to climb out' },
          { name: 'sofa - description.md', content: '# Linen Sofa' },
          { name: 'sofa - description.md', content: 'second copy' },
          { name: 42, content: 'ignored' },
        ],
      }) }))
    const r = await new OllamaExecutor({ host: s.host }).run(job)
    expect(r.ok).toBe(true)
    expect(r.engine).toBe('ollama')
    expect(r.local).toBe(true)
    expect(r.costUsd).toBe(0)
    expect(r.tokensIn).toBe(100)
    expect(r.summary).toBe('Wrote one description.')
    expect((await readdir(job.outputDir)).sort()).toEqual(['escape.md', 'sofa - description (2).md', 'sofa - description.md'])
    expect(await readdir(work)).toEqual(['input', 'output']) // nothing escaped
    const chat = s.requests.find((q) => q.path === '/api/chat')!.body
    expect(chat['stream']).toBe(false)
    expect((chat['format'] as { required: string[] }).required).toEqual(['summary', 'files'])
    expect(JSON.stringify(chat['messages'])).toContain('Linen sofa, oak legs')
  })

  it('json mode: invalid JSON is a clear failure', async () => {
    const s = await serve((path) => path === '/api/show' ? { json: { capabilities: ['completion'] } } : chatReply({ content: 'Sure! Here you go' }))
    const r = await new OllamaExecutor({ host: s.host }).run(job)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('The model did not return valid JSON.')
  })

  it('tools mode: a fenced agent loop with read, write and a denied escape', async () => {
    let turn = 0
    const s = await serve((path) => {
      if (path === '/api/show') return { json: { capabilities: ['completion', 'tools'] } }
      turn++
      if (turn === 1) return chatReply({ tool_calls: [{ function: { index: 0, name: 'read_file', arguments: { path: 'input/sofa.txt' } } }] })
      if (turn === 2) return chatReply({ tool_calls: [
        { function: { index: 0, name: 'read_file', arguments: { path: '../../../../etc/passwd' } } },
        { function: { index: 1, name: 'write_file', arguments: { path: 'input/sofa.txt', content: 'overwritten' } } },
        { function: { index: 2, name: 'run_shell', arguments: { command: 'rm -rf ~' } } },
      ] })
      if (turn === 3) return chatReply({ tool_calls: [{ function: { index: 0, name: 'write_file', arguments: { path: 'output/sofa - description.md', content: '# Linen Sofa' } } }] })
      return chatReply({ content: '<think>done</think>Wrote a description for the sofa.' })
    })
    const r = await new OllamaExecutor({ host: s.host }).run(job)
    expect(r.ok).toBe(true)
    expect(r.summary).toBe('Wrote a description for the sofa.')
    expect(r.toolCalls).toEqual(['Read', 'Write'])
    expect(r.tokensIn).toBe(400)
    expect(await readFile(join(job.outputDir, 'sofa - description.md'), 'utf-8')).toBe('# Linen Sofa')
    expect(await readFile(join(job.inputDir, 'sofa.txt'), 'utf-8')).toBe('Linen sofa, oak legs, 210 cm.')

    const chats = s.requests.filter((q) => q.path === '/api/chat')
    const toolNames = (chats[0]!.body['tools'] as Array<{ function: { name: string } }>).map((t) => t.function.name)
    expect(toolNames).toEqual(['read_file', 'write_file']) // only what the recipe grants
    const third = JSON.stringify(chats[2]!.body['messages'])
    expect(third).toContain('Only files inside this job folder can be used.')
    expect(third).toContain('Results can only be written to the output folder.')
    expect(third).toContain('run_shell is not available')
    expect(third).not.toContain('root:')
    const toolMsg = (chats[1]!.body['messages'] as Array<{ role: string; tool_name?: string; content: string }>).find((m) => m.role === 'tool')!
    expect(toolMsg.tool_name).toBe('read_file')
    expect(toolMsg.content).toBe('Linen sofa, oak legs, 210 cm.')
  })

  it('tools mode: gives up after too many steps', async () => {
    const s = await serve((path) => path === '/api/show'
      ? { json: { capabilities: ['tools'] } }
      : chatReply({ tool_calls: [{ function: { name: 'list_files', arguments: {} } }] }))
    const r = await new OllamaExecutor({ host: s.host, maxTurns: 3 }).run({ ...job, recipe: parseRecipe('Search', '---\ntools: Read, Write, Glob\nmodel: m\n---\nFind things.') })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('Stopped: the job took too many steps.')
  })

  it('images go to vision models and are refused by others', async () => {
    await writeFile(join(job.inputDir, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]))
    const blind = await serve((path) => path === '/api/show' ? { json: { capabilities: ['completion'] } } : chatReply({ content: '{}' }))
    const r1 = await new OllamaExecutor({ host: blind.host }).run(job)
    expect(r1.error).toContain("can't see images")

    const seeing = await serve((path) => path === '/api/show'
      ? { json: { capabilities: ['completion', 'vision'] } }
      : chatReply({ content: JSON.stringify({ summary: 'Described it.', files: [{ name: 'alt-text.csv', content: 'file,alt' }] }) }))
    const r2 = await new OllamaExecutor({ host: seeing.host }).run(job)
    expect(r2.ok).toBe(true)
    const msg = (seeing.requests.find((q) => q.path === '/api/chat')!.body['messages'] as Array<{ images?: string[] }>)[0]!
    expect(msg.images).toEqual([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]).toString('base64')])
  })

  it('refuses files a local model cannot read', async () => {
    await rm(join(job.inputDir, 'sofa.txt'))
    await writeFile(join(job.inputDir, 'deck.pdf'), Buffer.from([0x25, 0x50, 0x44, 0x46, 0, 0xff, 0xfe]))
    const s = await serve((path) => path === '/api/show' ? { json: { capabilities: ['completion'] } } : chatReply({ content: '{}' }))
    const r = await new OllamaExecutor({ host: s.host }).run(job)
    expect(r.error).toContain('Nothing here a local model can read')
  })

  it('uses the first installed model when none is named', async () => {
    const s = await serve((path, body) => path === '/api/tags'
      ? { json: { models: [{ name: 'qwen-local:7b' }, { name: 'other' }] } }
      : path === '/api/show' ? { json: { capabilities: ['completion'] } }
      : chatReply({ content: JSON.stringify({ summary: `ran on ${body['model']}`, files: [{ name: 'a.md', content: 'x' }] }) }))
    const r = await new OllamaExecutor({ host: s.host }).run({ ...job, recipe: { ...job.recipe, model: undefined } })
    expect(r.model).toBe('qwen-local:7b')
    expect(r.summary).toBe('ran on qwen-local:7b')
  })

  it('stops when the time limit aborts it', async () => {
    const s = await serve(() => ({ json: { capabilities: ['completion'] } }))
    const controller = new AbortController()
    controller.abort()
    const r = await new OllamaExecutor({ host: s.host }).run({ ...job, signal: controller.signal })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('Stopped: the job ran past its time limit.')
  })

  it('status() lists models and their capabilities for `magic-folder doctor`', async () => {
    const s = await serve((path, body) => path === '/api/tags'
      ? { json: { models: [{ name: 'a' }, { name: 'b' }] } }
      : { json: { capabilities: body['model'] === 'a' ? ['completion', 'tools'] : ['completion', 'vision'] } })
    const st = await new OllamaExecutor({ host: s.host }).status()
    expect(st.running).toBe(true)
    expect(st.models).toEqual([{ name: 'a', capabilities: ['completion', 'tools'] }, { name: 'b', capabilities: ['completion', 'vision'] }])
    expect((await new OllamaExecutor({ host: 'http://127.0.0.1:1' }).status()).running).toBe(false)
  })
})

describe('safeFileName', () => {
  it('keeps only a plain, visible file name', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd')
    expect(safeFileName('..\\..\\win.ini')).toBe('win.ini')
    expect(safeFileName('.env')).toBe('env')
    expect(safeFileName('')).toBe('result.md')
    expect(safeFileName('a<b>:c?.md')).toBe('abc.md')
  })
})

describe('engines', () => {
  it('recipes can name an engine; unknown engines are refused', () => {
    expect(parseRecipe('X', '---\nengine: ollama\n---\nDo it.').engine).toBe('ollama')
    expect(parseRecipe('X', '---\nengine: Claude\n---\nDo it.').engine).toBe('claude')
    expect(() => parseRecipe('X', '---\nengine: gpt\n---\nDo it.')).toThrow(RecipeError)
  })

  it('the router follows the recipe, falls back to the default, and reports missing engines', async () => {
    const claude = new FakeExecutor(async () => okResult({ summary: 'claude' }))
    const ollama = new FakeExecutor(async () => okResult({ summary: 'ollama' }))
    const base = { jobId: 'j', workDir: '/w', inputDir: '/w/input', outputDir: '/w/output', inputFiles: [], note: null, signal: new AbortController().signal }
    const router = new EngineRouter({ claude, ollama }, 'claude')
    expect((await router.run({ ...base, recipe: parseRecipe('A', 'Do.') })).summary).toBe('claude')
    const local = await router.run({ ...base, recipe: parseRecipe('B', '---\nengine: ollama\n---\nDo.') })
    expect(local.summary).toBe('ollama')
    expect(local.engine).toBe('fake')
    const missing = await new EngineRouter({ claude }, 'claude').run({ ...base, recipe: parseRecipe('C', '---\nengine: ollama\n---\nDo.') })
    expect(missing.ok).toBe(false)
    expect(missing.error).toContain("ollama engine, which isn't set up")
  })
})

describe('a Magic Folder job on the local engine', () => {
  it('signs a receipt that says it ran locally and was free', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mf-local-root-'))
    const dataDir = await mkdtemp(join(tmpdir(), 'mf-local-data-'))
    const s = await fakeOllama((path) => path === '/api/show'
      ? { json: { capabilities: ['completion'] } }
      : chatReply({ content: JSON.stringify({ summary: 'Fixed 2 typos.', files: [{ name: 'notes (fixed).txt', content: 'the cat' }] }) }))
    const folder = new MagicFolder(root, {
      dataDir,
      executor: new EngineRouter({ claude: new FakeExecutor(async () => okResult()), ollama: new OllamaExecutor({ host: s.host, model: 'test-model' }) }, 'ollama'),
    })
    try {
      await initMagicFolder(root)
      await writeFile(join(root, 'Fix typos', 'notes.txt'), 'teh cat')
      const [o] = await folder.scanOnce({ settle: false })
      expect(o!.ok).toBe(true)
      const meta = o!.receipt.metadata as Record<string, unknown>
      expect(meta['executor']).toBe('ollama')
      expect(meta['local']).toBe(true)
      expect(meta['cost_is_estimate']).toBe(false)
      expect(meta['credits']).toBe(0)
      expect(o!.receipt.cost_usd).toBe(0)
      expect(o!.receipt.model).toBe('test-model')
      expect(await readFile(join(o!.destination, 'result', 'notes (fixed).txt'), 'utf-8')).toBe('the cat')
      const data = extractReceiptData(await readFile(join(o!.destination, 'receipt.html'), 'utf-8'))!
      expect((data.receipt.metadata as Record<string, unknown>)['local']).toBe(true)
    } finally {
      folder.close()
      await s.close()
      await rm(root, { recursive: true, force: true })
      await rm(dataDir, { recursive: true, force: true })
    }
  })
})
