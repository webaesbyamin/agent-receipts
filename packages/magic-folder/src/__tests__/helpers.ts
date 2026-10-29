import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Executor, ExecResult, JobContext } from '../executor.js'

/** Test executor: does a scripted job without any model. */
export class FakeExecutor implements Executor {
  readonly name = 'fake'
  calls: JobContext[] = []

  constructor(private readonly behavior: (job: JobContext) => Promise<ExecResult>) {}

  run(job: JobContext): Promise<ExecResult> {
    this.calls.push(job)
    return this.behavior(job)
  }
}

export const okResult = (over: Partial<ExecResult> = {}): ExecResult => ({
  ok: true,
  summary: 'Wrote one description.',
  model: 'fake-model',
  tokensIn: 1200,
  tokensOut: 300,
  costUsd: 0.0123,
  toolCalls: ['Read', 'Write'],
  ...over,
})

/** Writes "<input> - description.md" for each input, uppercasing its text. */
export const describeEach = new FakeExecutor(async (job) => {
  for (const name of job.inputFiles) {
    const text = await readFile(join(job.inputDir, name), 'utf-8')
    await writeFile(join(job.outputDir, `${name} - description.md`), `# ${name}\n\n${text.toUpperCase()}\n`)
  }
  return okResult()
})
