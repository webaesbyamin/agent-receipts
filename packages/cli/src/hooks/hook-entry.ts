/**
 * The script Claude Code runs for each hook event: `node <this file> <mode>`.
 * Bundled into one self-contained file. Prints nothing and always exits 0, so
 * it can never block or break Claude Code; problems go to hooks.log.
 */
import { runHook } from './claude-code.js'

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk: string) => { input += chunk })
process.stdin.on('end', () => {
  runHook(process.argv.slice(2), input).finally(() => { process.exitCode = 0 })
})
process.stdin.on('error', () => { process.exitCode = 0 })
