import { readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { verifyAnyReceipt, computeKeyId } from '@agent-receipts/crypto'
import { KeyManager, ConfigManager } from '@agent-receipts/mcp-server'
import { MagicFolder } from './runner.js'
import type { MagicFolderEvent } from './runner.js'
import { ClaudeExecutor } from './claude-executor.js'
import { OllamaExecutor } from './ollama-executor.js'
import { EngineRouter } from './engines.js'
import { ENGINES } from './recipe.js'
import type { Engine } from './recipe.js'
import { initMagicFolder } from './starter.js'
import { extractReceiptData } from './render.js'
import { isApprovalOf } from './runner.js'
import { renderVerifyPage } from './verify-page.js'

const HELP = `magic-folder — drop a file in a folder, get the work back with a signed receipt

Usage:
  magic-folder init <folder>                 Create a Magic Folder with starter recipes
  magic-folder run <folder> [options]        Watch the folder and run jobs
      --once                                 Process what's there now, then exit
      --data-dir <dir>                       Receipts + signing key (default ~/.agent-receipts/magic-folder)
      --issuer <name>                        Name printed on receipts (e.g. "Webaes")
      --key-url <url>                        Where you publish your public key
      --verify-url <url>                     Link to a hosted verify page
      --engine claude|ollama                 Default engine (default: claude). Recipes can set their own.
      --model <id>                           Default Claude model for recipes without one
      --ollama-model <name>                  Default local model (default: first installed)
      --ollama-host <url>                    Ollama address (default http://127.0.0.1:11434)
      --ollama-mode auto|tools|json          How local models work (default auto)
  magic-folder doctor                        Check what's ready: Claude key, Agent SDK, Ollama models
  magic-folder key [--data-dir <dir>]        Print your key id and public key (publish these)
  magic-folder verify <receipt.html|json> [--key-id <key_…> | --key <hex>]
                                             Check a receipt. Without a key it can only say
                                             "unchanged", not who signed it.
  magic-folder verify-page [out.html] [--trust-key <key_… or public key> --trust-name <name>] [--title <t>]
                                             Write the static verify page (with your key baked in)
      Optional branding (none = the neutral page):
      --heading <text>                                          The visible heading, if not the --title
      --brand-name <text> --brand-sub <text> --home-url <url>   Header wordmark and its link
      --ink <#hex> --paper <#hex> --accent <#hex>               Colours (accent: focus, drop zone, invalid edge)
      --font-display <names> --font-body <names> --font-mono <names>
      --font-css <url or file.css>                              A stylesheet to link, or @font-face rules to inline
      --icon <url> --apple-icon <url> --theme-color <#hex>
      --description <text> --og-image <url> --canonical <url>   Search and sharing tags
      --link <label>=<url>                                      A footer link (repeat for more)

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
    case 'recovered': console.log(`${t}  ↺ ${e.jobId}: ${e.action === 'delivered' ? 'finished delivering an interrupted job' : 'interrupted before signing; files put back to run again'}`); break
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
      const engine = (flag(rest, '--engine') ?? 'claude') as Engine
      if (!(ENGINES as readonly string[]).includes(engine)) { console.error(`--engine must be one of ${ENGINES.join(', ')}`); return 1 }
      const ollamaMode = flag(rest, '--ollama-mode')
      if (ollamaMode && !['auto', 'tools', 'json'].includes(ollamaMode)) { console.error('--ollama-mode must be auto, tools or json'); return 1 }
      const ollamaModel = flag(rest, '--ollama-model')
      const ollamaHost = flag(rest, '--ollama-host')
      const executor = new EngineRouter({
        claude: new ClaudeExecutor(model ? { model } : {}),
        ollama: new OllamaExecutor({
          ...(ollamaModel ? { model: ollamaModel } : {}),
          ...(ollamaHost ? { host: ollamaHost } : {}),
          ...(ollamaMode ? { mode: ollamaMode as 'auto' | 'tools' | 'json' } : {}),
        }),
      }, engine)
      const mf = new MagicFolder(resolve(target), {
        executor,
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
      // Ctrl+C in a terminal; SIGTERM when a service manager (launchd, systemd) stops it
      await new Promise<void>((done) => {
        const stop = () => { mf.close(); done() }
        process.once('SIGINT', stop)
        process.once('SIGTERM', stop)
      })
      return 0
    }
    case 'doctor': {
      const ok = (b: boolean) => (b ? '✓' : '·')
      const major = Number(process.versions.node.split('.')[0])
      console.log(major < 22
        ? `· Node ${process.versions.node} is too old: install Node 24`
        : major > 24
          ? `· Node ${process.versions.node}: Magic Folder is tested on Node 22 to 24. If something fails, install Node 24`
          : `✓ Node ${process.versions.node} (Magic Folder needs 22 to 24)`)
      console.log(`${ok(!!process.env['ANTHROPIC_API_KEY'])} ANTHROPIC_API_KEY ${process.env['ANTHROPIC_API_KEY'] ? 'is set' : 'not set (needed for the claude engine)'}`)
      let sdk = false
      try { await import('@anthropic-ai/claude-agent-sdk' as string); sdk = true } catch { /* not installed */ }
      console.log(`${ok(sdk)} Claude Agent SDK ${sdk ? 'installed' : 'not installed (npm i @anthropic-ai/claude-agent-sdk)'}`)
      const st = await new OllamaExecutor(flag(argv, '--ollama-host') ? { host: flag(argv, '--ollama-host')! } : {}).status()
      if (!st.running) {
        console.log(`· Ollama not reachable at ${st.host} (install from ollama.com for free local jobs)`)
      } else if (!st.models.length) {
        console.log(`· Ollama running at ${st.host}, no models yet. Try: ollama pull qwen3:8b`)
      } else {
        console.log(`✓ Ollama running at ${st.host}`)
        for (const m of st.models) {
          const caps = m.capabilities.filter((c) => c !== 'completion')
          const how = m.capabilities.includes('tools') ? 'tools mode' : 'json mode'
          console.log(`    ${m.name.padEnd(28)} ${how}${caps.includes('vision') ? ', sees images' : ''}`)
        }
      }
      return 0
    }
    case 'key': {
      const dataDir = flag(argv, '--data-dir') ?? join(ConfigManager.getDefaultDataDir(), 'magic-folder')
      const km = new KeyManager(dataDir)
      await km.init()
      const publicKey = km.getPublicKey()
      const keyId = computeKeyId(publicKey)
      console.log(`Key id:     ${keyId}`)
      console.log(`Public key: ${publicKey}`)
      console.log('')
      console.log('Publish this (e.g. at https://yourdomain/.well-known/agent-receipts.json):')
      console.log(JSON.stringify({ keys: [{ key_id: keyId, public_key: publicKey, alg: 'ed25519' }] }, null, 2))
      return 0
    }
    case 'verify': {
      if (!target) { console.error('Usage: magic-folder verify <receipt.html|json> [--key-id <key_…> | --key <hex>]'); return 1 }
      const text = await readFile(target, 'utf-8')
      const data = text.trimStart().startsWith('{')
        ? { receipt: JSON.parse(text), approval: null, publicKey: null as string | null }
        : extractReceiptData(text)
      if (!data) { console.error('No receipt data found in that file.'); return 1 }
      const pinnedKey = flag(rest, '--key')
      const pinnedId = flag(rest, '--key-id') ?? (pinnedKey ? computeKeyId(pinnedKey) : undefined)
      const key = pinnedKey ?? data.publicKey
      if (!key) { console.error('This file has no public key; pass --key <hex>.'); return 1 }
      const r = verifyAnyReceipt(data.receipt as Record<string, unknown>, key)
      const signedBy = computeKeyId(key)
      if (!r.valid) { console.error(`NOT verified: ${data.receipt.receipt_id} (changed after signing, or wrong key)`); return 1 }
      if (data.approval) {
        const a = verifyAnyReceipt(data.approval as Record<string, unknown>, key, { requireV2: true })
        if (!a.valid || !isApprovalOf(data.receipt)(data.approval)) { console.error(`NOT verified: the approval on ${data.receipt.receipt_id} is not valid`); return 1 }
      }
      if (!r.covers_all_fields) {
        console.log(`Older format: ${data.receipt.receipt_id} only signs 12 core fields; its summary, cost and files are not covered.`)
        return 3
      }
      if (pinnedId && pinnedId !== signedBy) { console.error(`NOT verified: signed by ${signedBy}, not ${pinnedId}`); return 1 }
      if (!pinnedId) {
        console.log(`Unchanged since signing: ${data.receipt.receipt_id}${data.approval ? ' + approval' : ''}, signed by ${signedBy}.`)
        console.log('Signer not confirmed: pass --key-id <the issuer\'s key id> to confirm who signed it.')
        return 3
      }
      console.log(`Verified: ${data.receipt.receipt_id}${data.approval ? ' + approval' : ''}, signed by ${signedBy} (every field signed)`)
      return 0
    }
    case 'verify-page': {
      const trustKey = flag(argv, '--trust-key')
      const trustName = flag(argv, '--trust-name')
      if (trustKey && !trustName) { console.error('--trust-key needs --trust-name'); return 1 }
      const pageTitle = flag(argv, '--title')
      // --trust-key takes a key id (key_…) or the 64-hex public key; the public key also lets the page check receipt.json
      const trusted = trustKey && trustName
        ? [/^[0-9a-f]{64}$/i.test(trustKey) ? { publicKey: trustKey, name: trustName } : { keyId: trustKey, name: trustName }]
        : undefined
      // --font-css: an existing file's CSS is inlined; otherwise it's a stylesheet URL to link
      let fontCss = flag(argv, '--font-css')
      if (fontCss) fontCss = await readFile(fontCss, 'utf-8').catch(() => fontCss)
      const links = argv.flatMap((a, i) => (a === '--link' && argv[i + 1] ? [argv[i + 1]] : [])).map((l) => {
        const at = l.indexOf('=')
        if (at < 1) throw new Error(`--link needs <label>=<url>, not ${l}`)
        return { label: l.slice(0, at), url: l.slice(at + 1) }
      })
      const theme = {
        heading: flag(argv, '--heading'), brandName: flag(argv, '--brand-name'), brandSub: flag(argv, '--brand-sub'), homeUrl: flag(argv, '--home-url'),
        ink: flag(argv, '--ink'), paper: flag(argv, '--paper'), accent: flag(argv, '--accent'),
        fontDisplay: flag(argv, '--font-display'), fontBody: flag(argv, '--font-body'), fontMono: flag(argv, '--font-mono'), fontCss,
        icon: flag(argv, '--icon'), appleIcon: flag(argv, '--apple-icon'), themeColor: flag(argv, '--theme-color'),
        description: flag(argv, '--description'), ogImage: flag(argv, '--og-image'), canonical: flag(argv, '--canonical'),
        ...(links.length ? { links } : {}),
      }
      const html = renderVerifyPage({
        ...(pageTitle ? { title: pageTitle } : {}),
        ...(trusted ? { trustedKeys: trusted } : {}),
        theme,
      })
      const out = target && !target.startsWith('--') ? target : undefined
      if (out) { await writeFile(out, html); console.log(`Wrote ${out}`) } else process.stdout.write(html)
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
