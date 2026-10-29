// The site's install commands must be the ones CI tests: every command on
// /install has to appear verbatim in packages/magic-folder/README.md, which
// .github/workflows/install.yml follows on clean Mac, Windows and Linux machines.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OSES, UNINSTALL } from '../content/install.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const readme = readFileSync(join(here, '..', '..', '..', 'packages', 'magic-folder', 'README.md'), 'utf-8')
const workflow = readFileSync(join(here, '..', '..', '..', '.github', 'workflows', 'install.yml'), 'utf-8')
// The README (inside list items) and the workflow indent their copies: compare with indentation removed
const flat = (s) => s.split('\n').map((l) => l.trim()).join('\n')

const commands = []
for (const os of OSES) {
  for (const step of os.steps) for (const c of [step.code, step.code2]) if (c) commands.push([os.name, step.title, c])
  commands.push([os.name, 'Keep it running', os.keep.code])
  if (os.keep.alt) commands.push([os.name, 'Desktop launcher', os.keep.alt.code])
  for (const [label, c] of os.keep.controls) if (!c.startsWith('Close ')) commands.push([os.name, label, c])
}
commands.push(['all', 'Uninstall', UNINSTALL.code])

let bad = 0
for (const [os, where, cmd] of commands) {
  if (!flat(readme).includes(flat(cmd))) { bad++; console.error(`Not in the README (${os}, ${where}):\n${cmd}\n`) }
}
// The bigger blocks are also run, as written, by the install workflow
for (const os of OSES) {
  for (const block of [os.keep.code, os.keep.alt?.code].filter(Boolean)) {
    if (!flat(workflow).includes(flat(block))) { bad++; console.error(`Not run by install.yml (${os.name}):\n${block.split('\n')[0]}…\n`) }
  }
}
if (bad) process.exit(1)
console.log(`install guide: ${commands.length} commands match the README and the install workflow`)
