import type { Executor, ExecResult, JobContext } from './executor.js'
import type { Engine } from './recipe.js'

/**
 * Picks the engine per job: the recipe's `engine:` if it names one,
 * otherwise the runner's default. Records which engine ran on the result.
 */
export class EngineRouter implements Executor {
  readonly name = 'router'

  constructor(
    private readonly engines: Partial<Record<Engine, Executor>>,
    private readonly defaultEngine: Engine,
  ) {}

  async run(job: JobContext): Promise<ExecResult> {
    const engine = job.recipe.engine ?? this.defaultEngine
    const executor = this.engines[engine]
    if (!executor) {
      return {
        ok: false, summary: '', model: null, tokensIn: null, tokensOut: null, costUsd: null, toolCalls: [],
        engine, error: `This recipe uses the ${engine} engine, which isn't set up here.`,
      }
    }
    const result = await executor.run(job)
    return { ...result, engine: result.engine ?? executor.name }
  }
}
