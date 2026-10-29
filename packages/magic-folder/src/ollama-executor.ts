import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, extname, basename, dirname } from 'node:path'
import { isInside } from './executor.js'
import type { Executor, ExecResult, JobContext } from './executor.js'
import { listFiles } from './files.js'
import { checkToolUse } from './claude-executor.js'

/**
 * Runs jobs on a local model through Ollama (https://ollama.com).
 * Free, private, no API key: nothing leaves the computer.
 *
 * Two modes:
 * - tools: for models with the "tools" capability. The model gets
 *   read_file / write_file / list_files / search_files / replace_in_file,
 *   implemented here (not by the model), and every call passes the same
 *   sandbox gate as the Claude engine.
 * - json: for every other model (and the more reliable choice for small
 *   models). Input files go into the prompt; the model answers with JSON
 *   matching a schema ({ summary, files: [{ name, content }] }) and the
 *   runner writes the files.
 * `auto` (default) uses tools when the model supports them.
 */
export interface OllamaOptions {
  /** Default http://127.0.0.1:11434, or $OLLAMA_HOST */
  host?: string
  /** Default model when a recipe doesn't name one. Omitted: the first installed model. */
  model?: string
  mode?: 'auto' | 'tools' | 'json'
  /** Most tool-loop rounds before giving up. Default 12. */
  maxTurns?: number
  /** Context window to request. Default 16384. */
  numCtx?: number
  /** For tests: a fetch implementation */
  fetch?: typeof fetch
}

const IMAGE_TYPES: Record<string, string> = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp', '.gif': 'gif' }
const MAX_TEXT_BYTES = 256 * 1024
const MAX_PROMPT_TEXT_BYTES = 512 * 1024
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_OUTPUT_FILES = 20
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, content: { type: 'string' } },
        required: ['name', 'content'],
      },
    },
  },
  required: ['summary', 'files'],
}

/** Ollama tool name -> the recipe tool it needs, and the gate input it maps to. */
const TOOL_DEFS = {
  read_file: { recipeTool: 'Read', description: 'Read a text file from the job folder. Paths look like "input/notes.txt".', params: { path: 'string' } },
  write_file: { recipeTool: 'Write', description: 'Write a result file. The path must start with "output/".', params: { path: 'string', content: 'string' } },
  replace_in_file: { recipeTool: 'Edit', description: 'Replace exact text in a file under "output/".', params: { path: 'string', old_text: 'string', new_text: 'string' } },
  list_files: { recipeTool: 'Glob', description: 'List every file in the job folder (input/ and output/).', params: {} },
  search_files: { recipeTool: 'Grep', description: 'Find lines containing some text in the job folder files.', params: { text: 'string' } },
} as const
type ToolName = keyof typeof TOOL_DEFS

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  images?: string[]
  tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>
  tool_name?: string
}

interface ChatResponse {
  model?: string
  message?: ChatMessage
  prompt_eval_count?: number
  eval_count?: number
  done_reason?: string
  error?: string
}

export class OllamaError extends Error {}

export class OllamaExecutor implements Executor {
  readonly name = 'ollama'
  private readonly host: string
  private readonly doFetch: typeof fetch

  constructor(private readonly options: OllamaOptions = {}) {
    this.host = (options.host ?? process.env['OLLAMA_HOST'] ?? 'http://127.0.0.1:11434').replace(/\/+$/, '')
    if (!/^https?:\/\//.test(this.host)) this.host = `http://${this.host}`
    this.doFetch = options.fetch ?? fetch
  }

  async run(job: JobContext): Promise<ExecResult> {
    const usage = { in: 0, out: 0 }
    const toolCalls: string[] = []
    let model = job.recipe.model ?? this.options.model ?? null
    let mode: 'tools' | 'json' | undefined
    try {
      model ??= await this.firstInstalledModel(job.signal)
      const capabilities = await this.capabilities(model, job.signal)
      const inputs = await readInputs(job)
      if (inputs.images.length && !capabilities.includes('vision')) {
        throw new OllamaError(`${model} can't see images. Use a vision model (for example one with "vision" in \`ollama show\`), or drop text files.`)
      }
      mode = this.options.mode === 'json' || this.options.mode === 'tools'
        ? this.options.mode
        : capabilities.includes('tools') ? 'tools' : 'json'
      if (mode === 'tools' && !capabilities.includes('tools')) {
        throw new OllamaError(`${model} doesn't support tool calling. Use --ollama-mode json or a model with "tools" in \`ollama show\`.`)
      }

      const summary = mode === 'tools'
        ? await this.runTools(job, model, inputs, usage, toolCalls)
        : await this.runJson(job, model, inputs, usage, toolCalls)

      return {
        ok: true, summary: oneParagraph(summary), model, tokensIn: usage.in, tokensOut: usage.out,
        costUsd: 0, toolCalls: [...new Set(toolCalls)], engine: 'ollama', local: true, mode,
      }
    } catch (err) {
      return {
        ok: false, summary: '', model, tokensIn: usage.in || null, tokensOut: usage.out || null,
        costUsd: 0, toolCalls: [...new Set(toolCalls)], engine: 'ollama', local: true, ...(mode ? { mode } : {}),
        error: job.signal.aborted ? 'Stopped: the job ran past its time limit.' : describe(err, this.host),
      }
    }
  }

  /** JSON mode: files in, `{ summary, files }` out. */
  private async runJson(job: JobContext, model: string, inputs: Inputs, usage: { in: number; out: number }, toolCalls: string[]): Promise<string> {
    if (!job.recipe.tools.includes('Write')) {
      throw new OllamaError('JSON mode writes result files, so the recipe needs the Write tool.')
    }
    const prompt = [
      `You are running the "${job.recipe.name}" job.`,
      '',
      'Instruction:',
      job.recipe.instruction,
      '',
      ...(job.note ? ['Note from the person who dropped the files:', job.note, ''] : []),
      'Input files:',
      ...inputs.texts.map((t) => `=== FILE: ${t.name} ===\n${t.text}\n=== END FILE ===`),
      ...inputs.images.map((i) => `(image attached: ${i.name})`),
      ...inputs.skipped.map((s) => `(not readable here: ${s})`),
      '',
      'Reply with JSON only, matching this schema:',
      '{"summary": "one or two plain sentences about what you produced", "files": [{"name": "result file name, e.g. sofa - description.md", "content": "the full file content"}]}',
      'Use clear file names a non-technical person understands. Put every result in "files".',
    ].join('\n')

    const res = await this.chat({
      model,
      messages: [{ role: 'user', content: prompt, ...(inputs.images.length ? { images: inputs.images.map((i) => i.base64) } : {}) }],
      format: RESULT_SCHEMA,
      options: { temperature: 0.2, num_ctx: this.options.numCtx ?? 16384 },
    }, job.signal)
    usage.in += res.prompt_eval_count ?? 0
    usage.out += res.eval_count ?? 0

    let parsed: { summary?: unknown; files?: unknown }
    try {
      parsed = JSON.parse(res.message?.content ?? '')
    } catch {
      throw new OllamaError('The model did not return valid JSON.')
    }
    const files = Array.isArray(parsed.files) ? parsed.files : []
    let written = 0
    for (const f of files.slice(0, MAX_OUTPUT_FILES)) {
      if (!f || typeof f !== 'object') continue
      const { name, content } = f as { name?: unknown; content?: unknown }
      if (typeof name !== 'string' || typeof content !== 'string') continue
      if (Buffer.byteLength(content) > MAX_OUTPUT_BYTES) continue
      const target = await freeOutputName(job.outputDir, safeFileName(name))
      await writeFile(target, content)
      written++
    }
    return typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary
      : `Produced ${written} file${written === 1 ? '' : 's'}.`
  }

  /** Tools mode: a small agent loop over tools implemented (and fenced) here. */
  private async runTools(job: JobContext, model: string, inputs: Inputs, usage: { in: number; out: number }, toolCalls: string[]): Promise<string> {
    const available = (Object.keys(TOOL_DEFS) as ToolName[]).filter((t) => (job.recipe.tools as string[]).includes(TOOL_DEFS[t].recipeTool))
    const tools = available.map((t) => ({
      type: 'function',
      function: {
        name: t,
        description: TOOL_DEFS[t].description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(Object.entries(TOOL_DEFS[t].params).map(([k, type]) => [k, { type }])),
          required: Object.keys(TOOL_DEFS[t].params),
        },
      },
    }))
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          `You are running the "${job.recipe.name}" job in a folder with input/ and output/.`,
          'Use the tools to read the inputs and write every result file under output/. Never change input files.',
          'When you are done, reply with one or two plain sentences describing what you produced, and no tool calls.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          'Instruction:', job.recipe.instruction, '',
          ...(job.note ? ['Note from the person who dropped the files:', job.note, ''] : []),
          'Input files:', ...[...inputs.texts.map((t) => t.name), ...inputs.images.map((i) => i.name), ...inputs.skipped].map((n) => `- input/${n}`),
          ...(inputs.images.length ? ['', 'The images are attached to this message.'] : []),
        ].join('\n'),
        ...(inputs.images.length ? { images: inputs.images.map((i) => i.base64) } : {}),
      },
    ]

    const maxTurns = this.options.maxTurns ?? 12
    for (let turn = 0; turn < maxTurns; turn++) {
      const res = await this.chat({ model, messages, tools, options: { temperature: 0.2, num_ctx: this.options.numCtx ?? 16384 } }, job.signal)
      usage.in += res.prompt_eval_count ?? 0
      usage.out += res.eval_count ?? 0
      const msg = res.message ?? { role: 'assistant', content: '' }
      messages.push({ role: 'assistant', content: msg.content ?? '', ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}) })
      const calls = msg.tool_calls ?? []
      if (calls.length === 0) return msg.content ?? ''
      for (const call of calls) {
        const name = call.function?.name as ToolName
        const args = (call.function?.arguments ?? {}) as Record<string, unknown>
        const result = await this.runTool(job, available, name, args)
        if (TOOL_DEFS[name]) toolCalls.push(TOOL_DEFS[name].recipeTool)
        messages.push({ role: 'tool', tool_name: String(name), content: result })
      }
    }
    throw new OllamaError('Stopped: the job took too many steps.')
  }

  /** Execute one tool call inside the job folder. Errors go back to the model as text. */
  private async runTool(job: JobContext, available: ToolName[], name: ToolName, args: Record<string, unknown>): Promise<string> {
    if (!available.includes(name)) return `Error: ${String(name)} is not available in this job.`
    const def = TOOL_DEFS[name]
    const rel = typeof args['path'] === 'string' ? args['path'] : ''
    const abs = rel ? join(job.workDir, rel) : job.workDir
    const gateInput = name === 'list_files' || name === 'search_files' ? { path: job.workDir } : { file_path: abs }
    const gate = checkToolUse(job, def.recipeTool, gateInput)
    if (gate.behavior === 'deny') return `Error: ${gate.message}`
    try {
      switch (name) {
        case 'read_file': {
          const s = await stat(abs)
          if (s.size > MAX_TEXT_BYTES) return 'Error: file too large to read.'
          const buf = await readFile(abs)
          return looksLikeText(buf) ? buf.toString('utf-8') : 'Error: not a text file.'
        }
        case 'write_file': {
          const content = typeof args['content'] === 'string' ? args['content'] : ''
          if (Buffer.byteLength(content) > MAX_OUTPUT_BYTES) return 'Error: content too large.'
          await mkdir(dirname(abs), { recursive: true })
          await writeFile(abs, content)
          return `Wrote ${rel}.`
        }
        case 'replace_in_file': {
          const oldText = String(args['old_text'] ?? '')
          const current = await readFile(abs, 'utf-8')
          if (!oldText || !current.includes(oldText)) return 'Error: old_text not found.'
          await writeFile(abs, current.replace(oldText, String(args['new_text'] ?? '')))
          return `Updated ${rel}.`
        }
        case 'list_files': {
          const files = await listFiles(job.workDir)
          return files.length ? files.join('\n') : '(no files)'
        }
        case 'search_files': {
          const needle = String(args['text'] ?? '')
          if (!needle) return 'Error: text is required.'
          const hits: string[] = []
          for (const f of await listFiles(job.workDir)) {
            const buf = await readFile(join(job.workDir, f))
            if (buf.length > MAX_TEXT_BYTES || !looksLikeText(buf)) continue
            buf.toString('utf-8').split('\n').forEach((line, i) => { if (line.includes(needle) && hits.length < 50) hits.push(`${f}:${i + 1}: ${line}`) })
          }
          return hits.length ? hits.join('\n') : 'No matches.'
        }
      }
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message.replace(job.workDir, '') : 'failed'}`
    }
    return 'Error: unknown tool.'
  }

  private async chat(body: Record<string, unknown>, signal: AbortSignal): Promise<ChatResponse> {
    return this.post('/api/chat', { ...body, stream: false }, signal) as Promise<ChatResponse>
  }

  private async capabilities(model: string, signal: AbortSignal): Promise<string[]> {
    const res = await this.post('/api/show', { model }, signal) as { capabilities?: unknown }
    return Array.isArray(res.capabilities) ? res.capabilities.filter((c): c is string => typeof c === 'string') : ['completion']
  }

  private async firstInstalledModel(signal: AbortSignal): Promise<string> {
    const res = await this.request('/api/tags', { method: 'GET', signal })
    const models = Array.isArray((res as { models?: unknown }).models) ? (res as { models: Array<{ name?: string }> }).models : []
    const first = models.find((m) => typeof m.name === 'string')?.name
    if (!first) throw new OllamaError('No Ollama models are installed. Run: ollama pull qwen3:8b')
    return first
  }

  private post(path: string, body: unknown, signal: AbortSignal): Promise<unknown> {
    return this.request(path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, signal })
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    let res: Response
    try {
      res = await this.doFetch(`${this.host}${path}`, init)
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err
      throw new OllamaError(`Ollama isn't running at ${this.host}. Open the Ollama app (or run: ollama serve).`)
    }
    const text = await res.text()
    let json: unknown = null
    try { json = JSON.parse(text) } catch { /* not JSON */ }
    const err = json && typeof json === 'object' ? (json as { error?: unknown }).error : undefined
    if (!res.ok || typeof err === 'string') {
      const model = path === '/api/show' || path === '/api/chat' ? (JSON.parse(String(init.body ?? '{}')) as { model?: string }).model : undefined
      if (res.status === 404 && model) throw new OllamaError(`The model ${model} isn't installed. Run: ollama pull ${model}`)
      throw new OllamaError(`Ollama error: ${typeof err === 'string' ? err : `HTTP ${res.status}`}`)
    }
    return json
  }

  /** Is Ollama reachable, and which models are installed? (for `magic-folder doctor`) */
  async status(): Promise<{ running: boolean; host: string; models: Array<{ name: string; capabilities: string[] }>; error?: string }> {
    const signal = AbortSignal.timeout(5000)
    try {
      const tags = await this.request('/api/tags', { method: 'GET', signal }) as { models?: Array<{ name?: string }> }
      const models: Array<{ name: string; capabilities: string[] }> = []
      for (const m of tags.models ?? []) {
        if (typeof m.name !== 'string') continue
        let capabilities: string[] = []
        try { capabilities = await this.capabilities(m.name, signal) } catch { /* older Ollama */ }
        models.push({ name: m.name, capabilities })
      }
      return { running: true, host: this.host, models }
    } catch (err) {
      return { running: false, host: this.host, models: [], error: describe(err, this.host) }
    }
  }
}

interface Inputs {
  texts: Array<{ name: string; text: string }>
  images: Array<{ name: string; base64: string }>
  skipped: string[]
}

async function readInputs(job: JobContext): Promise<Inputs> {
  const out: Inputs = { texts: [], images: [], skipped: [] }
  let textBytes = 0
  for (const name of await listFiles(job.inputDir)) {
    const path = join(job.inputDir, name)
    const ext = extname(name).toLowerCase()
    const size = (await stat(path)).size
    if (IMAGE_TYPES[ext]) {
      if (size > MAX_IMAGE_BYTES) { out.skipped.push(`${name} (image over 10 MB)`); continue }
      out.images.push({ name, base64: (await readFile(path)).toString('base64') })
      continue
    }
    if (size > MAX_TEXT_BYTES || textBytes + size > MAX_PROMPT_TEXT_BYTES) { out.skipped.push(`${name} (too large)`); continue }
    const buf = await readFile(path)
    if (!looksLikeText(buf)) { out.skipped.push(`${name} (not a text file)`); continue }
    textBytes += size
    out.texts.push({ name, text: buf.toString('utf-8') })
  }
  if (!out.texts.length && !out.images.length) {
    throw new OllamaError(`Nothing here a local model can read: ${out.skipped.join(', ') || 'no files'}. Save documents as .txt, .md or .csv.`)
  }
  return out
}

function looksLikeText(buf: Buffer): boolean {
  if (buf.includes(0)) return false
  const text = buf.toString('utf-8')
  return !text.includes(String.fromCharCode(0xfffd)) // invalid UTF-8 decodes to U+FFFD
}

/** "../../etc/x" -> "x"; "" -> "result.md"; no hidden files, no folders. */
export function safeFileName(name: string): string {
  const base = basename(name.replace(/\\/g, '/')).replace(/[\u0000-\u001f<>:"|?*]/g, '').trim().replace(/^\.+/, '')
  return (base || 'result.md').slice(0, 120)
}

async function freeOutputName(outputDir: string, name: string): Promise<string> {
  const dot = name.lastIndexOf('.')
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  for (let i = 1; ; i++) {
    const candidate = join(outputDir, i === 1 ? name : `${stem} (${i})${ext}`)
    if (!isInside(outputDir, candidate)) throw new OllamaError('Bad result file name.')
    try { await stat(candidate) } catch { return candidate }
  }
}

function oneParagraph(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\s+/g, ' ').trim().slice(0, 600)
}

function describe(err: unknown, host: string): string {
  if (err instanceof OllamaError) return err.message
  if ((err as Error)?.name === 'AbortError') return 'Stopped: the job ran past its time limit.'
  return `Ollama at ${host} failed: ${err instanceof Error ? err.message : String(err)}`
}
