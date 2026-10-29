import { readFile, writeFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { exists } from './files.js'

export const CHANGES_FILE = 'changes.md'
export const NO_CHANGES = 'No changes were needed.'
/** Words of context shown before a change that is only punctuation, or only adds or removes words. */
const CONTEXT_WORDS = 2
/** Above this many word pairs a file is compared line by line only. */
const MAX_DIFF_CELLS = 4_000_000

type Op = { kind: 'same' | 'del' | 'ins'; token: string }

/** Longest-common-subsequence diff of two token lists. */
function diff(a: string[], b: string[]): Op[] {
  const n = a.length
  const m = b.length
  const w = m + 1
  const table = new Uint32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * w + j] = a[i] === b[j] ? table[(i + 1) * w + j + 1]! + 1 : Math.max(table[(i + 1) * w + j]!, table[i * w + j + 1]!)
    }
  }
  const ops: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ kind: 'same', token: a[i]! }); i++; j++ }
    else if (table[(i + 1) * w + j]! >= table[i * w + j + 1]!) ops.push({ kind: 'del', token: a[i++]! })
    else ops.push({ kind: 'ins', token: b[j++]! })
  }
  while (i < n) ops.push({ kind: 'del', token: a[i++]! })
  while (j < m) ops.push({ kind: 'ins', token: b[j++]! })
  return ops
}

const words = (text: string): string[] => text.split(/\s+/).filter(Boolean)
const letters = (text: string): string => text.replace(/[\p{P}\p{S}]/gu, '')

/**
 * Every word-level difference between an original and its corrected copy,
 * as "before → after". Changes that are only punctuation, or only add or
 * remove words, carry the words just before them so the line reads on its own.
 * Whitespace and line breaks are not counted as changes.
 */
export function wordChanges(original: string, fixed: string): string[] {
  const a = original.split(/\r?\n/)
  const b = fixed.split(/\r?\n/)
  // Lines first, then words within each changed run of lines, so big files stay cheap.
  const lineOps = a.length * b.length > MAX_DIFF_CELLS ? null : diff(a, b)
  const changes: string[] = []
  const compare = (before: string[], after: string[]) => {
    const x = words(before.join('\n'))
    const y = words(after.join('\n'))
    if (x.length * y.length > MAX_DIFF_CELLS) {
      if (x.join(' ') !== y.join(' ')) changes.push(`${x.join(' ')} → ${y.join(' ')}`)
      return
    }
    const ops = diff(x, y)
    const seen: string[] = []
    for (let k = 0; k < ops.length;) {
      if (ops[k]!.kind === 'same') { seen.push(ops[k]!.token); k++; continue }
      const del: string[] = []
      const ins: string[] = []
      while (k < ops.length && ops[k]!.kind !== 'same') (ops[k]!.kind === 'del' ? del : ins).push(ops[k++]!.token)
      const from = del.join(' ')
      const to = ins.join(' ')
      const needsContext = !from || !to || letters(from) === letters(to)
      const lead = needsContext ? seen.slice(-CONTEXT_WORDS) : []
      const tail = needsContext && !lead.length && k < ops.length ? [ops[k]!.token] : []
      changes.push(`${[...lead, from, ...tail].filter(Boolean).join(' ')} → ${[...lead, to, ...tail].filter(Boolean).join(' ')}`)
      seen.push(...ins)
    }
  }
  if (!lineOps) { compare(a, b); return changes }
  for (let k = 0; k < lineOps.length;) {
    if (lineOps[k]!.kind === 'same') { k++; continue }
    const del: string[] = []
    const ins: string[] = []
    while (k < lineOps.length && lineOps[k]!.kind !== 'same') (lineOps[k]!.kind === 'del' ? del : ins).push(lineOps[k++]!.token)
    compare(del, ins)
  }
  return changes
}

/** "notes.txt" -> "notes (fixed).txt" */
export function fixedName(name: string): string {
  const ext = extname(name)
  return `${name.slice(0, name.length - ext.length)} (fixed)${ext}`
}

/**
 * Write changes.md from the files themselves: each input against its
 * "(fixed)" copy. Replaces whatever the agent wrote there. Returns how many
 * inputs had a corrected copy (0 means there was nothing to report on).
 */
export async function writeChangesReport(inputDir: string, outputDir: string, inputs: string[]): Promise<number> {
  const sections: Array<{ name: string; lines: string[] }> = []
  let compared = 0
  for (const name of inputs) {
    const fixed = join(outputDir, fixedName(name))
    if (!(await exists(fixed))) {
      sections.push({ name, lines: ['No corrected copy was made.'] })
      continue
    }
    compared++
    const lines = wordChanges(await readFile(join(inputDir, name), 'utf-8'), await readFile(fixed, 'utf-8'))
    sections.push({ name, lines: lines.length ? lines.map((l) => `- ${l}`) : [NO_CHANGES] })
  }
  if (!compared) return 0
  const body = sections.length === 1
    ? sections[0]!.lines.join('\n')
    : sections.map((s) => `## ${s.name}\n\n${s.lines.join('\n')}`).join('\n\n')
  await writeFile(join(outputDir, CHANGES_FILE), `${body}\n`)
  return compared
}
