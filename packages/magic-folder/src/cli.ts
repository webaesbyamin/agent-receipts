import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { verifyAnyReceipt } from '@agent-receipts/crypto'
import { MagicFolder } from './runner.js'
import type { MagicFolderEvent } from './runner.js'
import { ClaudeExecutor } from './claude-executor.js'
import { initMagicFolder } from './starter.js'
import { extractReceiptData } from './render.js'
import { renderVerifyPage } from './verify-page.js'

const HELP = `magic-folder — drop a file in a folder, get the work back with a signed receipt

Usage:
  magic-folder init <folder>                 Create a Magic Folder with starter recipes
  magic-folder run <folder> [options]        Watch the folder and run jobs
      --once                                 Process what's there now, then exit
      --data-dir <dir>                       Receipts + signing key (default ~/.agent-receipts)
      --issuer <name>                        Name printed on receipts (e.g. "Webaes")
      --key-url <url>                        Where you publish your public key
      --verify-url <url>                     Link to a hosted verify page
      --model <id>                           Default model for recipes without one
  magic-folder verify <receipt.html|json> [--key <hex>]
                                             Check a receipt's seal
  magic-folder verify-page [out.html]        Write the static public verify page

Running jobs needs ANTHROPIC_API_KEY and: npm install @anthropic-ai/claude-agent-sdk
`

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i !== -1 ? args[i + 1] : undefined
}

function log(e: MagicFolderEvent): void {
  const t = new Date().toLocaleTimeString()
  switch (e.type) {
    case 'job-started': console.log(`${t}  ▸ ${e.recipe}: ${e.files.join(', ')}`); break
    case 'job-finished': console.log(`${t}  ${e.ok ? '✓' : '✗'} ${e.recipe} → ${e.destination}  (${e.receiptId})`); break
    case 'approved': console.log(`${t}  ✓ approved ${e.jobId}  (${e.receiptId})`); break
    case 'recipe-error': console.error(`${t}  ! ${e.message}`); break
    case 'error': console.error(`${t}  ! ${e.message}`); break
  }
}

async function main(argv: string[]): Promise<number> {
  const [cmd, target, ...rest] = argv
  switch (cmd) {
    case 'init': {
      if (!target) { console.error('Usage: magic-folder init <folder>'); return 1 }
      const created = await initMagicFolder(resolve(target))
      console.log(`Magic Folder ready at ${resolve(target)}`)
      for (const name of created) console.log(`  + ${name}`)
      console.log(`Next: magic-folder run "${target}"`)
      return 0
    }
    case 'run': {
      if (!target) { console.error('Usage: magic-folder run <folder>'); return 1 }
      const issuerName = flag(rest, '--issuer')
      const keyUrl = flag(rest, '--key-url')
      const model = flag(rest, '--model')
      const mf = new MagicFolder(resolve(target), {
        executor: new ClaudeExecutor(model ? { model } : {}),
        dataDir: flag(rest, '--data-dir'),
        issuer: issuerName ? { name: issuerName, ...(keyUrl ? { keyUrl } : {}) } : undefined,
        verifyPageUrl: flag(rest, '--verify-url'),
        onEvent: log,
      })
      if (rest.includes('--once')) {
        const out = await mf.scanOnce({ settle: false })
        mf.close()
        console.log(`${out.length} job${out.length === 1 ? '' : 's'} processed`)
        return out.every((o) => o.ok) ? 0 : 2
      }
      await mf.start()
      console.log(`Watching ${resolve(target)} — signing key ${mf.receipts.getPublicKey().slice(0, 16)}… (Ctrl+C to stop)`)
      await new Promise<void>((done) => process.once('SIGINT', () => { mf.close(); done() }))
      return 0
    }
    case 'verify': {
      if (!target) { console.error('Usage: magic-folder verify <receipt.html|json> [--key <hex>]'); return 1 }
      const text = await readFile(target, 'utf-8')
      const data = text.trimStart().startsWith('{')
        ? { receipt: JSON.parse(text), approval: null, publicKey: null as string | null }
        : extractReceiptData(text)
      if (!data) { console.error('No receipt data found in that file.'); return 1 }
      const key = flag(rest, '--key') ?? data.publicKey
      if (!key) { console.error('This file has no public key; pass --key <hex>.'); return 1 }
      const r = verifyAnyReceipt(data.receipt as Record<string, unknown>, key)
      const a = data.approval ? verifyAnyReceipt(data.approval as Record<string, unknown>, key, { requireV2: true }) : null
      if (r.valid && (!a || a.valid)) {
        console.log(`Verified: ${data.receipt.receipt_id} (${r.covers_all_fields ? 'every field signed' : 'v1: 12 core fields signed'})${a ? ' + approval' : ''}`)
        console.log(`Key: ${data.receipt.key_id ?? key}`)
        return 0
      }
      console.error(`NOT verified: ${data.receipt.receipt_id}${r.valid ? ' (approval failed)' : ''}`)
      return 1
    }
    case 'verify-page': {
      const html = renderVerifyPage()
      if (target) { await writeFile(target, html); console.log(`Wrote ${target}`) } else process.stdout.write(html)
      return 0
    }
    default:
      console.log(HELP)
      return cmd && cmd !== 'help' && cmd !== '--help' ? 1 : 0
  }
}

main(process.argv.slice(2)).then(
  (code) => { process.exitCode = code },
  (err) => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1 },
)
