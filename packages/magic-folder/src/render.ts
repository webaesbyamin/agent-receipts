import type { ActionReceipt } from '@agent-receipts/schema'
import { BROWSER_VERIFY_JS } from './browser-verify.js'
import { BROWSER_RENDER_JS, RECEIPT_CSS } from './browser-render.js'

export interface Issuer {
  /** Shown at the top of every receipt, e.g. "Webaes". Stored in the signed metadata. */
  name: string
  /** Where the issuer publishes its public keys (shown so a client can compare) */
  keyUrl?: string
}

export interface RenderOptions {
  publicKey: string
  /** Optional link to a hosted copy of the public verify page */
  verifyPageUrl?: string
  /** A later approval receipt for this job, if it was approved */
  approval?: ActionReceipt | null
  /** Time zone for printed times (default: the viewer's) */
  timeZone?: string
}

export interface ReceiptPageData {
  receipt: ActionReceipt
  approval: ActionReceipt | null
  publicKey: string
  verifyPageUrl?: string
  timeZone?: string
}

/**
 * One self-contained receipt page. No network needed to read or verify it.
 *
 * The page holds the signed receipt as JSON and renders every visible word
 * from it in the browser, then checks the signature. Nothing a person reads
 * is written outside the signed record.
 */
export function renderReceiptHtml(receipt: ActionReceipt, opts: RenderOptions): string {
  const data: ReceiptPageData = {
    receipt,
    approval: opts.approval ?? null,
    publicKey: opts.publicKey,
    ...(opts.verifyPageUrl ? { verifyPageUrl: opts.verifyPageUrl } : {}),
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<meta name="robots" content="noindex">
<title>Receipt</title>
<style>${RECEIPT_CSS}</style>
</head>
<body>
<main class="sheet" id="app">
  <noscript><div class="noscript">This receipt shows its details with JavaScript. You can also check it with <code>magic-folder verify receipt.html</code> or on the Agent Receipts verify page.</div></noscript>
</main>
<script type="application/json" id="receipt-data">${jsonForScript(data)}</script>
<script>
${BROWSER_VERIFY_JS}
${BROWSER_RENDER_JS}
(async function () {
  var app = document.getElementById('app');
  var d;
  try { d = JSON.parse(document.getElementById('receipt-data').textContent); }
  catch (e) { app.innerHTML = '<div class="noscript">The receipt data on this page is damaged.</div>'; return; }
  document.title = 'Receipt · ' + arRecipeName(d.receipt);
  app.innerHTML = arRenderReceipt(d, { state: 'checking', title: 'Checking the seal…', sub: 'This page checks its own signature. Nothing is sent anywhere.' });
  var r = await arVerify(d.receipt, d.publicKey, { requireV2: true });
  var a = d.approval ? await arVerify(d.approval, d.publicKey, { requireV2: true }) : null;
  var genuine = !d.approval || arIsApprovalOf(d.approval, d.receipt);
  // A page can only show it hasn't been changed. Who signed it is confirmed
  // by the issuer's own verify page, which knows the issuer's key.
  var seal = (r.valid && (!a || a.valid) && genuine)
    ? { state: 'ok', title: 'Unchanged since signing', sub: 'Signed by ' + r.key_id + (a ? ', approval included' : '') + '. Confirm the signer on the issuer\\'s verify page.' }
    : { state: 'bad', title: 'Not verified', sub: (!r.valid ? r.reason : !genuine ? 'The approval on this page is not a valid approval of this job.' : a.reason) || 'This receipt could not be verified.' };
  app.innerHTML = arRenderReceipt(d, seal);
})();
</script>
</body>
</html>
`
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const LINE_SEP = new RegExp(String.fromCharCode(0x2028), 'g')
const PARA_SEP = new RegExp(String.fromCharCode(0x2029), 'g')

/** JSON that is safe inside <script>: no "</script>", no HTML comment openers, no line separators. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEP, '\\u2028')
    .replace(PARA_SEP, '\\u2029')
}

/** Pull the embedded receipt data back out of a receipt.html. */
export function extractReceiptData(html: string): ReceiptPageData | null {
  const m = html.match(/<script type="application\/json" id="receipt-data">([\s\S]*?)<\/script>/)
  if (!m || m[1] === undefined) return null
  try {
    return JSON.parse(m[1]) as ReceiptPageData
  } catch {
    return null
  }
}
