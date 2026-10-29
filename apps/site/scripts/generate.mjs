// Pulls the real product into the site at build time, so nothing is retyped:
// the starter recipes, the in-browser verifier and the receipt renderer come
// from @agent-receipts/magic-folder; the receipt is a real Webaes job.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { STARTER_RECIPES, parseRecipe, BROWSER_VERIFY_JS, BROWSER_RENDER_JS, RECEIPT_CSS } from '@agent-receipts/magic-folder'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'src', 'generated')
mkdirSync(out, { recursive: true })

const recipes = Object.entries(STARTER_RECIPES).map(([name, source]) => {
  const r = parseRecipe(name, source)
  return { name, instruction: r.instruction, needsApproval: r.needsApproval, tools: r.tools, maxMinutes: r.maxMinutes }
})
const { JOBS } = await import('../content/jobs.mjs')
const missing = recipes.map((r) => r.name).filter((n) => !JOBS[n])
const extra = Object.keys(JOBS).filter((n) => !recipes.some((r) => r.name === n))
if (missing.length || extra.length) throw new Error(`content/jobs.mjs is out of step with STARTER_RECIPES (missing: ${missing.join(', ') || 'none'}; unknown: ${extra.join(', ') || 'none'})`)

const receipt = JSON.parse(readFileSync(join(here, '..', 'content', 'webaes-receipt.json'), 'utf-8'))

writeFileSync(join(out, 'product.json'), JSON.stringify({ recipes, receipt, verifyJs: BROWSER_VERIFY_JS, renderJs: BROWSER_RENDER_JS, receiptCss: RECEIPT_CSS }, null, 2))
console.log(`site content: ${recipes.length} recipes, receipt ${receipt.receipt_id}`)
