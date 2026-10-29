/**
 * A recipe is a folder. Its hidden `.recipe.md` says what happens to files
 * dropped into it:
 *
 *   ---
 *   credits: 1
 *   tools: Read, Write
 *   max_minutes: 5
 *   max_cost_usd: 0.50
 *   needs_approval: false
 *   engine: ollama                  (optional: claude or ollama)
 *   model: qwen3:8b                 (optional: model id for that engine)
 *   ---
 *   Write a product description for the item in the dropped file...
 *
 * The folder name is the recipe's name. Everything below the front matter is
 * the instruction given to the agent.
 */

export const RECIPE_FILE = '.recipe.md'

/** Tools a recipe may grant. Anything else is refused at parse time. */
export const ALLOWED_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep'] as const
export type RecipeTool = (typeof ALLOWED_TOOLS)[number]

export interface Recipe {
  /** Folder name, shown to people ("Write product descriptions") */
  name: string
  /** The instruction the agent follows */
  instruction: string
  /** Credits one successful job costs. Failed jobs cost 0. */
  credits: number
  tools: RecipeTool[]
  maxMinutes: number
  maxCostUsd: number
  /** Results go to "Needs your OK" instead of "Done" */
  needsApproval: boolean
  /** Model id; omitted = the engine's default */
  model?: string
  /** Which engine runs it; omitted = the runner's default */
  engine?: Engine
}

export const ENGINES = ['claude', 'ollama'] as const
export type Engine = (typeof ENGINES)[number]

export const RECIPE_DEFAULTS = {
  credits: 1,
  tools: ['Read', 'Write'] as RecipeTool[],
  maxMinutes: 5,
  maxCostUsd: 0.5,
  needsApproval: false,
}

export class RecipeError extends Error {}

export function parseRecipe(name: string, source: string): Recipe {
  const text = source.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  let front: Record<string, string> = {}
  let body = text

  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---', 4)
    if (end === -1) throw new RecipeError(`${name}: front matter is not closed with ---`)
    front = parseFrontMatter(name, text.slice(4, end))
    body = text.slice(end + 4).replace(/^[^\n]*\n?/, '')
  }

  const instruction = body.trim()
  if (!instruction) throw new RecipeError(`${name}: the recipe has no instruction`)

  const recipe: Recipe = {
    name,
    instruction,
    credits: number(name, front, 'credits', RECIPE_DEFAULTS.credits, 0, 1000),
    tools: tools(name, front['tools']),
    maxMinutes: number(name, front, 'max_minutes', RECIPE_DEFAULTS.maxMinutes, 0.1, 120),
    maxCostUsd: number(name, front, 'max_cost_usd', RECIPE_DEFAULTS.maxCostUsd, 0, 100),
    needsApproval: bool(name, front['needs_approval'], RECIPE_DEFAULTS.needsApproval),
  }
  if (front['model']) recipe.model = front['model']
  if (front['engine']) {
    const e = front['engine'].toLowerCase()
    if (!(ENGINES as readonly string[]).includes(e)) {
      throw new RecipeError(`${name}: engine must be one of ${ENGINES.join(', ')} (got "${front['engine']}")`)
    }
    recipe.engine = e as Engine
  }
  return recipe
}

function parseFrontMatter(name: string, block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of block.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx === -1) throw new RecipeError(`${name}: can't read front matter line "${line}"`)
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    out[key] = value
  }
  return out
}

function number(name: string, front: Record<string, string>, key: string, fallback: number, min: number, max: number): number {
  const raw = front[key]
  if (raw === undefined || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new RecipeError(`${name}: ${key} must be a number from ${min} to ${max} (got "${raw}")`)
  }
  return n
}

function bool(name: string, raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') return fallback
  const v = raw.toLowerCase()
  if (['true', 'yes', '1'].includes(v)) return true
  if (['false', 'no', '0'].includes(v)) return false
  throw new RecipeError(`${name}: needs_approval must be true or false (got "${raw}")`)
}

function tools(name: string, raw: string | undefined): RecipeTool[] {
  if (raw === undefined || raw.trim() === '') return [...RECIPE_DEFAULTS.tools]
  const list = raw.replace(/^\[|\]$/g, '').split(',').map((t) => t.trim()).filter(Boolean)
  for (const t of list) {
    if (!(ALLOWED_TOOLS as readonly string[]).includes(t)) {
      throw new RecipeError(`${name}: tool "${t}" is not allowed (allowed: ${ALLOWED_TOOLS.join(', ')})`)
    }
  }
  return [...new Set(list)] as RecipeTool[]
}
