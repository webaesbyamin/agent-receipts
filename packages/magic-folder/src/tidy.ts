/**
 * Small clean-ups the runner applies before it hashes and signs, so clients
 * see what they dropped in, not the job's internal folder layout.
 */

/**
 * Strip the job's own paths from the agent's summary: absolute job paths,
 * `.magic/jobs/<id>/`, and the `input/` and `output/` prefixes.
 * "Fixed input/notes.txt" -> "Fixed notes.txt".
 */
export function cleanSummary(summary: string, workDirs: string[]): string {
  let s = summary
  // Longest first, so /private/var/… goes before the /var/… it contains.
  for (const dir of [...workDirs].sort((a, b) => b.length - a.length)) {
    for (const sub of ['input', 'output']) s = s.split(`${dir}/${sub}/`).join('')
    s = s.split(`${dir}/`).join('')
  }
  return s
    .replace(/[^\s"'`(]*\.magic\/jobs\/[^/\s]+\//g, '')
    .replace(/(^|[\s"'`(\[“‘])(?:\.\/)?(?:input|output)\/(?=\S)/g, '$1')
}

const ARROW = /\s(?:->|→|=>)\s/
const LIST_MARKER = /^(?:[-*+]|\d+[.)])\s+/
/** Some models echo the format as a label: "before -> after: teh -> the". */
const FORMAT_LABEL = /^before\s*(?:->|→|=>)\s*after\s*:\s*/i
const WRAPPERS = /^[\s"'`“”‘’*]+|[\s"'`“”‘’*]+$/g

/**
 * Remove "before -> after" lines that aren't changes: both sides the same
 * (`"two days." -> "two days."`), or the format's own "before -> after"
 * placeholder. Every other line is kept as written.
 */
export function dropNoOpChanges(text: string): string {
  return text
    .split('\n')
    .filter((line) => {
      const sides = line.replace(/\r$/, '').trim().replace(LIST_MARKER, '').replace(FORMAT_LABEL, '').split(ARROW)
      if (sides.length !== 2) return true
      const [before, after] = sides.map((t) => t.replace(WRAPPERS, ''))
      if (before === after) return false
      return !(before!.toLowerCase() === 'before' && after!.toLowerCase() === 'after')
    })
    .join('\n')
}
