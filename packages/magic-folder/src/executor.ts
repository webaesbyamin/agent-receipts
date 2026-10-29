import { resolve, sep, dirname, basename, join } from 'node:path'
import { realpathSync, lstatSync } from 'node:fs'
import type { Recipe } from './recipe.js'

/** What the runner hands an executor for one job. */
export interface JobContext {
  jobId: string
  recipe: Recipe
  /** Job workspace. Inputs are in `${workDir}/input`, results go in `${workDir}/output`. */
  workDir: string
  inputDir: string
  outputDir: string
  /** File names inside inputDir */
  inputFiles: string[]
  /** Text from a note.txt dropped alongside, if any */
  note: string | null
  signal: AbortSignal
}

/**
 * What an executor reports back. The runner does NOT trust this for files:
 * it hashes the output folder itself. Usage numbers come from the model API
 * response, not from anything the agent says.
 */
export interface ExecResult {
  ok: boolean
  /** One or two plain sentences about what was produced */
  summary: string
  model: string | null
  tokensIn: number | null
  tokensOut: number | null
  /** Estimated model cost in USD (client-side estimate; never bill from it) */
  costUsd: number | null
  toolCalls: string[]
  error?: string
}

export interface Executor {
  readonly name: string
  run(job: JobContext): Promise<ExecResult>
}

/** The prompt every executor gives the agent, built from the recipe. */
export function buildPrompt(job: JobContext): string {
  const lines = [
    `You are running the "${job.recipe.name}" recipe in a Magic Folder.`,
    '',
    'Instruction:',
    job.recipe.instruction,
    '',
    `Input files (in ${job.inputDir}):`,
    ...job.inputFiles.map((f) => `- ${f}`),
  ]
  if (job.note) {
    lines.push('', 'Note from the person who dropped the file:', job.note)
  }
  lines.push(
    '',
    'Rules:',
    `- Write every result file into ${job.outputDir}. Nothing else will be kept.`,
    '- Never modify or delete the input files.',
    '- Use clear file names a non-technical person understands.',
    '- When finished, reply with one or two plain sentences describing what you produced. No markdown.',
  )
  return lines.join('\n')
}

/**
 * True when `target` is inside `root`, after resolving `.`/`..` and symlinks
 * (for whatever part of the path already exists), so a symlink inside the
 * job folder can't point the agent somewhere else.
 */
export function isInside(root: string, target: string): boolean {
  const r = real(resolve(root))
  const t = real(resolve(resolve(root), target))
  return t === r || t.startsWith(r + sep)
}

/** realpath of the longest existing prefix, with the rest appended. */
function real(p: string): string {
  try {
    return realpathSync(p)
  } catch {
    // A dangling symlink: realpath fails, but writing through it would land
    // wherever it points. Treat it as outside everything.
    try {
      if (lstatSync(p).isSymbolicLink()) return '\0dangling-symlink'
    } catch { /* doesn't exist: fine */ }
    const parent = dirname(p)
    if (parent === p) return p
    return join(real(parent), basename(p))
  }
}
