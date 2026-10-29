import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import { webcrypto } from 'node:crypto'
import { generateKeyPair, signReceipt, getSignablePayload } from '@agent-receipts/crypto'
import { SqliteReceiptStore, KeyManager, ConfigManager, ReceiptEngine } from '@agent-receipts/mcp-server'
import type { ActionReceipt } from '@agent-receipts/schema'
import { BROWSER_VERIFY_JS } from '../browser-verify.js'
import { BROWSER_RENDER_JS } from '../browser-render.js'
import { renderReceiptHtml, extractReceiptData } from '../render.js'
import { renderVerifyPage } from '../verify-page.js'

/** Run the exact browser verifier string in a sandbox with browser-like globals. */
function browserVerifier() {
  const ctx = createContext({ crypto: webcrypto, TextEncoder, atob, Uint8Array, JSON, Object, Array, String, parseInt, Intl, Date, Math, isNaN })
  runInContext(BROWSER_VERIFY_JS, ctx)
  runInContext(BROWSER_RENDER_JS, ctx)
  return {
    verify: (r: unknown, key: string, opts?: unknown) =>
      runInContext('arVerify', ctx)(JSON.parse(JSON.stringify(r)), key, opts) as Promise<{
        valid: boolean; sig_version: number; covers_all_fields: boolean; key_id: string; key_id_matches: boolean | null; reason: string
      }>,
    keyId: (k: string) => runInContext('arKeyId', ctx)(k) as Promise<string>,
    render: (d: unknown, seal: unknown) => runInContext('arRenderReceipt', ctx)(JSON.parse(JSON.stringify(d)), seal) as string,
    isApprovalOf: (a: unknown, r: unknown) => runInContext('arIsApprovalOf', ctx)(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(r))) as boolean,
  }
}

describe('browser verifier (same bytes as the Node signer)', () => {
  let dir: string
  let store: SqliteReceiptStore
  let engine: ReceiptEngine
  let publicKey: string
  let receipt: ActionReceipt

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mf-browser-'))
    store = new SqliteReceiptStore(dir)
    await store.init()
    const km = new KeyManager(dir)
    await km.init()
    const cm = new ConfigManager(dir)
    await cm.init()
    engine = new ReceiptEngine(store, km, cm)
    publicKey = km.getPublicKey()
    receipt = await engine.track({
      action: 'magic_folder.test',
      input: { a: 1 },
      output: 'x',
      output_summary: 'Wrote "quotes", <tags> & émojis ✓ — fine',
      cost_usd: 0.0042,
      metadata: { recipe: 'Write product descriptions', nested: { z: [1, { b: 2, a: 1 }], a: null } },
      files: [{ name: 'naïve file.txt', sha256: `sha256:${'c'.repeat(64)}`, bytes: 12, role: 'input' }],
    })
  })

  afterAll(async () => {
    store.getDb().close()
    await rm(dir, { recursive: true, force: true })
  })

  it('verifies a v2 receipt signed in Node', async () => {
    const r = await browserVerifier().verify(receipt, publicKey, { requireV2: true })
    expect(r.valid).toBe(true)
    expect(r.covers_all_fields).toBe(true)
    expect(r.key_id_matches).toBe(true)
  })

  it('computes the same key id as Node', async () => {
    expect(await browserVerifier().keyId(publicKey)).toBe(receipt.key_id)
  })

  it('rejects any edit, including nested metadata and unicode text', async () => {
    const v = browserVerifier()
    expect((await v.verify({ ...receipt, output_summary: 'Wrote "quotes"' }, publicKey)).valid).toBe(false)
    expect((await v.verify({ ...receipt, cost_usd: 0 }, publicKey)).valid).toBe(false)
    expect((await v.verify({ ...receipt, metadata: { ...receipt.metadata, recipe: 'x' } }, publicKey)).valid).toBe(false)
    expect((await v.verify({ ...receipt, files: [] }, publicKey)).valid).toBe(false)
  })

  it('rejects a downgrade and a wrong key', async () => {
    const v = browserVerifier()
    const { sig_version: _drop, ...stripped } = receipt
    expect((await v.verify(stripped, publicKey)).valid).toBe(false)
    const other = generateKeyPair()
    const r = await v.verify(receipt, other.publicKey)
    expect(r.valid).toBe(false)
    expect(r.key_id_matches).toBe(false)
  })

  it('rejects a __proto__ key smuggled into a signed receipt', async () => {
    const v = browserVerifier()
    const tampered = JSON.parse(JSON.stringify(receipt).replace('{', '{"__proto__":{"x":1},'))
    expect((await v.verify(tampered, publicKey)).valid).toBe(false)
  })

  it('only a genuine approval of this job counts as an approval', async () => {
    const v = browserVerifier()
    const real = await engine.track({ action: 'magic_folder.approved', input: 1, parent_receipt_id: receipt.receipt_id, metadata: { kind: 'magic_folder_approval' } })
    expect(v.isApprovalOf(real, receipt)).toBe(true)
    const anyChild = await engine.track({ action: 'some_tool', input: 2, parent_receipt_id: receipt.receipt_id })
    expect(v.isApprovalOf(anyChild, receipt)).toBe(false)
    const otherJob = await engine.track({ action: 'magic_folder.approved', input: 3, parent_receipt_id: 'rcpt_other', metadata: { kind: 'magic_folder_approval' } })
    expect(v.isApprovalOf(otherJob, receipt)).toBe(false)
  })

  it('verifies legacy v1 receipts unless requireV2', async () => {
    const { privateKey, publicKey: pk } = generateKeyPair()
    const v1: Record<string, unknown> = {
      receipt_id: 'rcpt_v1', chain_id: 'chain_v1', receipt_type: 'action', agent_id: 'a', org_id: 'o',
      action: 'old', input_hash: 'sha256:i', output_hash: null, status: 'completed',
      timestamp: '2026-01-01T00:00:00.000Z', completed_at: '2026-01-01T00:00:01.000Z', environment: 'production',
      output_summary: 'unsigned in v1',
    }
    v1['signature'] = signReceipt(getSignablePayload(v1 as Parameters<typeof getSignablePayload>[0]), privateKey)
    const v = browserVerifier()
    const r = await v.verify(v1, pk)
    expect(r.valid).toBe(true)
    expect(r.covers_all_fields).toBe(false)
    expect((await v.verify(v1, pk, { requireV2: true })).valid).toBe(false)
  })

  it('round-trips through receipt.html', async () => {
    const html = renderReceiptHtml(receipt, { publicKey })
    const data = extractReceiptData(html)!
    expect(data.receipt).toEqual(receipt)
    const r = await browserVerifier().verify(data.receipt, data.publicKey, { requireV2: true })
    expect(r.valid).toBe(true)
  })

  it('every visible word comes from the signed data (no separate text to tamper with)', () => {
    const html = renderReceiptHtml(receipt, { publicKey })
    const body = html.slice(html.indexOf('<body>'), html.indexOf('<script type="application/json"'))
    expect(body).not.toContain('Write product descriptions')
    expect(body).not.toContain(receipt.output_summary!)
  })

  it('the renderer escapes hostile text from the receipt', async () => {
    const hostile = await engine.track({
      action: 'x', input: 1,
      output_summary: '<img src=x onerror=alert(1)> & "quotes"',
      metadata: { recipe: '<b>Recipe</b>', issuer: { name: 'Studio <script>', key_url: 'javascript:alert(1)' } },
      files: [{ name: '<svg onload=alert(1)>.txt', sha256: `sha256:${'d'.repeat(64)}`, bytes: 1, role: 'input' }],
    })
    const out = browserVerifier().render({ receipt: hostile, approval: null, publicKey, verifyPageUrl: 'javascript:alert(2)' }, { state: 'ok', title: 'Verified', sub: '' })
    expect(out).not.toContain('<img')
    expect(out).not.toContain('<svg')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<b>Recipe')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot;')
  })

  it('a receipt that fails its check says so at the top, not "Done"', () => {
    const out = browserVerifier().render({ receipt, approval: null, publicKey }, { state: 'bad', title: 'Not verified', sub: '' })
    expect(out).toContain('pill bad">Not verified')
    expect(out).toContain('failed its check')
    expect(out).not.toContain('pill good')
  })

  it('renders a done job, a job waiting for OK, and a failed job', async () => {
    const v = browserVerifier()
    const seal = { state: 'ok', title: 'Verified', sub: '' }
    const done = v.render({ receipt, approval: null, publicKey }, seal)
    expect(done).toContain('Done')
    expect(done).toContain('naïve file.txt')
    expect(done).toContain('&lt; $0.01') // $0.0042 shows as "< $0.01"
    const waiting = await engine.track({ action: 'x', input: 2, output_summary: 'Drafted.', metadata: { recipe: 'Draft a client email', needs_approval: true, credits: 1 } })
    expect(v.render({ receipt: waiting, approval: null, publicKey }, seal)).toContain('Waiting for your OK')
    const pending = await engine.create({ action: 'x', input_hash: 'sha256:1', metadata: { recipe: 'Fix typos', credits: 1 } })
    const failed = await engine.complete(pending.receipt_id, { status: 'failed', error: { message: 'Stopped: the job hit its cost limit' } })
    const f = v.render({ receipt: failed, approval: null, publicKey }, seal)
    expect(f).toContain('Did not finish')
    expect(f).toContain('Stopped: the job hit its cost limit.')
    expect(f).toContain('Nothing was charged.')
  })

  it('a summary containing </script> cannot break out of the data block', async () => {
    const evil = await engine.track({ action: 'x', input: 1, output_summary: '</script><script>alert(1)</script>' })
    const html = renderReceiptHtml(evil, { publicKey })
    expect(html.match(/<\/script>/g)!.length).toBe(2) // only the two real closing tags
    expect(extractReceiptData(html)!.receipt.output_summary).toBe('</script><script>alert(1)</script>')
  })

  it('every inline script in receipt.html and the verify page parses', async () => {
    const { Script } = await import('node:vm')
    const pages = [renderReceiptHtml(receipt, { publicKey, verifyPageUrl: 'https://example.com/verify' }), renderVerifyPage(), renderVerifyPage({ trustedKeys: [{ name: "O'Brien & Co", keyId: receipt.key_id! }] })]
    for (const html of pages) {
      const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!)
      expect(scripts.length).toBeGreaterThan(0)
      for (const src of scripts) expect(() => new Script(src)).not.toThrow()
    }
  })

  it('a verify page can trust a public key (so receipt.json works) and rejects mismatches', () => {
    const page = renderVerifyPage({ trustedKeys: [{ name: 'Webaes', publicKey }] })
    const trusted = JSON.parse(page.match(/<script type="application\/json" id="trusted-keys">([\s\S]*?)<\/script>/)![1]!)
    expect(trusted).toEqual([{ name: 'Webaes', keyId: receipt.key_id, publicKey }])
    expect(() => renderVerifyPage({ trustedKeys: [{ name: 'X', keyId: 'key_0000000000000000', publicKey }] })).toThrow('does not match')
    expect(() => renderVerifyPage({ trustedKeys: [{ name: 'X', publicKey: 'nothex' }] })).toThrow('Not a public key')
  })

  it('receipt.html is locked to the light theme and mobile-safe', () => {
    const html = renderReceiptHtml(receipt, { publicKey })
    expect(html).toContain('<meta name="color-scheme" content="light only">')
    expect(html).toContain('viewport-fit=cover')
    expect(html).toContain('background-image:linear-gradient')
    expect(html).toContain('min-width:0')
  })

  it('the committed public verify page matches the generator', async () => {
    const committed = await readFile(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'apps', 'verify', 'index.html'), 'utf-8')
    expect(committed).toBe(renderVerifyPage())
  })
})
