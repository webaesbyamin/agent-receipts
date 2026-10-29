import { BROWSER_VERIFY_JS } from './browser-verify.js'
import { BROWSER_RENDER_JS, RECEIPT_CSS } from './browser-render.js'
import { jsonForScript } from './render.js'

export interface TrustedKey {
  /** Who this key belongs to, e.g. "Webaes" */
  name: string
  /** key_… id (from `magic-folder key`) */
  keyId: string
}

export interface VerifyPageOptions {
  title?: string
  /**
   * Keys this page vouches for. An issuer hosts a copy of this page with its
   * own key baked in; receipts signed by that key show "Verified — signed by
   * <name>". With no trusted keys (the generic page), a receipt is only shown
   * as verified when the visitor enters the key or opens a link with ?key=.
   */
  trustedKeys?: TrustedKey[]
}

/**
 * The public verify page: one static HTML file. Someone drops a receipt.html
 * (or receipt.json) on it and the check runs in their browser. No upload,
 * no account, no server.
 *
 * A receipt file carries its own public key, so on its own it only proves it
 * wasn't changed, not who signed it (anyone can sign a fake with their own
 * key). This page shows a green "Verified" only when the signing key matches
 * a key it trusts.
 */
export function renderVerifyPage(options: VerifyPageOptions = {}): string {
  const title = options.title ?? 'Verify a receipt'
  const trusted = (options.trustedKeys ?? []).map((k) => {
    if (!/^key_[0-9a-f]{16}$/.test(k.keyId)) throw new Error(`Not a key id: ${k.keyId}`)
    return { name: k.name, keyId: k.keyId }
  })
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light only">
<title>${safeTitle}</title>
<style>
${RECEIPT_CSS}
main{max-width:620px;margin:0 auto}
.page-title{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-weight:500;font-size:32px;line-height:1.15;margin:0 0 8px}
.page-lead{color:#3c3830;margin:0 0 22px}
.drop{display:block;border:1.5px dashed #cfc7b6;border-radius:16px;padding:34px 18px;text-align:center;background-color:#fffefb;background-image:linear-gradient(180deg,#fffefb,#fbf8f1);cursor:pointer}
.drop.over{border-color:var(--good);background:#f2f7f3}
.drop strong{display:block;font-size:16px;margin-bottom:4px}
.drop span{color:var(--muted);font-size:13.5px}
input[type=file]{position:absolute;left:-9999px}
label.k{display:block;margin:20px 0 6px;font-size:12px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase}
input[type=text]{width:100%;font:13px ui-monospace,SFMono-Regular,Menlo,monospace;padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:#fffefb;color:var(--ink)}
.trusted{margin:14px 0 0;font-size:13.5px;color:#3c3830}
.result{margin-top:22px;padding:18px;border-radius:14px;border:1px solid var(--line);background:#fffefb;display:none}
.result.ok{display:block;border-color:#c9dccf;background:var(--good-bg)}
.result.warn{display:block;border-color:#eadbb5;background:var(--wait-bg)}
.result.bad{display:block;border-color:#e8c9c2;background:var(--bad-bg)}
.result h2{margin:0 0 4px;font-size:18px;text-transform:none;letter-spacing:0;color:inherit}
.result.ok h2{color:var(--good)}.result.warn h2{color:var(--wait)}.result.bad h2{color:var(--bad)}
.result p{margin:4px 0;overflow-wrap:anywhere}
.result dl{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin:14px 0 0}
.result dl div{min-width:0}
.fine{margin-top:28px;font-size:13px;color:var(--muted)}
#shown{margin-top:22px}
[hidden]{display:none!important}
</style>
</head>
<body>
<main>
  <h1 class="page-title">${safeTitle}</h1>
  <p class="page-lead">Drop a receipt here to check it. The check runs in your browser; the file never leaves your device.</p>

  <label class="drop" id="drop" for="file">
    <strong>Drop receipt.html or receipt.json</strong>
    <span>or tap to choose a file</span>
  </label>
  <input type="file" id="file" accept=".html,.htm,.json,application/json,text/html">

  <p class="trusted" id="trusted-note" hidden></p>
  <label class="k" for="expected">Signer's key ID or public key</label>
  <input type="text" id="expected" placeholder="key_… or 64-character public key" autocomplete="off" spellcheck="false">

  <section class="result" id="result" aria-live="polite">
    <h2 id="r-title"></h2>
    <p id="r-sub"></p>
    <dl id="r-details"></dl>
  </section>

  <div class="sheet" id="shown" hidden></div>

  <p class="fine">Receipts are signed with Ed25519. A valid signature proves the receipt is exactly as it was signed. It proves who signed it only when the signing key is one you trust: one this page vouches for, or one you entered above.</p>
</main>
<script type="application/json" id="trusted-keys">${jsonForScript(trusted)}</script>
<script>
${BROWSER_VERIFY_JS}
${BROWSER_RENDER_JS}
var TRUSTED = JSON.parse(document.getElementById('trusted-keys').textContent);
var lastFile = null;
(function () {
  // No ?key= parameter on purpose: a link could otherwise carry an attacker's
  // key and turn a forged receipt green.
  if (TRUSTED.length) {
    var n = document.getElementById('trusted-note');
    n.textContent = 'This page confirms receipts signed by ' + TRUSTED.map(function (k) { return k.name + ' (' + k.keyId + ')'; }).join(', ') + '.';
    n.hidden = false;
  }
})();
function arExtract(text) {
  var t = text.trim();
  if (t.charAt(0) === '{') {
    var j = JSON.parse(t);
    if (j.receipt) return { receipt: j.receipt, approval: j.approval || null, publicKey: j.publicKey || j.public_key || null };
    return { receipt: j, approval: null, publicKey: null };
  }
  var m = text.match(/<script type="application\\/json" id="receipt-data">([\\s\\S]*?)<\\/script>/);
  if (!m) throw new Error('No receipt data in this file.');
  return JSON.parse(m[1]);
}
function show(kind, title, sub, rows) {
  var box = document.getElementById('result');
  box.className = 'result ' + kind;
  document.getElementById('r-title').textContent = title;
  document.getElementById('r-sub').textContent = sub;
  var dl = document.getElementById('r-details'); dl.innerHTML = '';
  (rows || []).forEach(function (r) {
    var d = document.createElement('div'); var dt = document.createElement('dt'); var dd = document.createElement('dd');
    dt.textContent = r[0]; dd.textContent = r[1]; if (r[2]) dd.className = 'mono'; d.appendChild(dt); d.appendChild(dd); dl.appendChild(d);
  });
}
function showReceipt(data, seal) {
  var el = document.getElementById('shown');
  if (!seal) { el.hidden = true; el.innerHTML = ''; return; }
  el.innerHTML = arRenderReceipt({ receipt: data.receipt, approval: data.approval || null, publicKey: data.publicKey }, seal);
  el.hidden = false;
}
async function check(text) {
  showReceipt(null, null);
  var data;
  try { data = arExtract(text); } catch (e) { show('bad', 'Not a receipt', 'This file has no receipt data in it.'); return; }
  var expected = document.getElementById('expected').value.trim();
  var key = data.publicKey || (/^[0-9a-f]{64}$/i.test(expected) ? expected : null);
  if (!key) { show('bad', 'Need a public key', 'This receipt file has no key in it. Paste the signer\\'s 64-character public key above.'); return; }
  var r = await arVerify(data.receipt, key, { requireV2: false });
  var signedRows = [['Action', data.receipt.action], ['Status', data.receipt.status], ['Receipt', data.receipt.receipt_id, true], ['Signed by key', r.key_id || '\\u2014', true]];
  if (!r.valid) { show('bad', 'Not verified', r.reason || 'The receipt could not be verified.', signedRows); return; }
  if (r.sig_version !== 2) {
    show('warn', 'Older receipt format', 'Only 12 core fields of this receipt are signed. Its summary, cost and files could have been changed, so they are not shown.', signedRows);
    return;
  }

  // Who signed it? A page with built-in keys only ever trusts those; a typed
  // key can narrow the check but never vouch for a key the page doesn't know.
  var signer = null, mismatch = null;
  for (var i = 0; i < TRUSTED.length; i++) if (TRUSTED[i].keyId === r.key_id) signer = TRUSTED[i].name;
  if (expected) {
    var expectedId = /^[0-9a-f]{64}$/i.test(expected) ? await arKeyId(expected) : expected;
    if (expectedId !== r.key_id) { mismatch = expectedId; signer = null; }
    else if (!TRUSTED.length) signer = 'the key you entered';
  }
  if (mismatch) { show('bad', 'Signed by a different key', 'The receipt is intact, but it was signed by ' + r.key_id + ', not ' + mismatch + '.', signedRows); return; }
  if (TRUSTED.length && !signer) {
    var names = TRUSTED.map(function (k) { return k.name; }).join(' or ');
    show('bad', 'Not signed by ' + names, 'This receipt was signed by ' + r.key_id + ', which is not ' + names + '\\'s key. Treat it as not genuine.', signedRows);
    return;
  }

  var a = null;
  if (data.approval) {
    a = await arVerify(data.approval, key, { requireV2: true });
    if (!a.valid || !arIsApprovalOf(data.approval, data.receipt)) { show('bad', 'Approval not verified', (a.valid ? 'This is not a valid approval of this job.' : a.reason), signedRows); return; }
  }

  var rows = [['What', arRecipeName(data.receipt)], ['Status', data.receipt.status], ['Receipt', data.receipt.receipt_id, true], ['Signed by key', r.key_id, true]];
  if (signer) {
    show('ok', 'Verified', 'Signed by ' + signer + '. Every detail below is covered by the signature' + (a ? ', including the approval.' : '.'), rows);
    showReceipt(data, { state: 'ok', title: 'Verified', sub: 'Signed by ' + signer + '. Shown by this page from the signed record.' });
  } else {
    show('warn', 'Unchanged, signer not confirmed', 'Nothing in this receipt changed since it was signed by ' + r.key_id + '. Anyone can sign with their own key, so check that this is the issuer\\'s key: enter the key they gave you above.', rows);
    showReceipt(data, { state: 'warn', title: 'Signer not confirmed', sub: 'Signed by ' + r.key_id + '. Enter the issuer\\'s key above to confirm it.' });
  }
}
function readFile(f) { lastFile = f; var fr = new FileReader(); fr.onload = function () { check(String(fr.result)); }; fr.readAsText(f); }
var drop = document.getElementById('drop');
document.getElementById('file').addEventListener('change', function (e) { if (e.target.files[0]) readFile(e.target.files[0]); });
document.getElementById('file').addEventListener('click', function (e) { e.target.value = ''; });
document.getElementById('expected').addEventListener('input', function () { if (lastFile) readFile(lastFile); });
['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) readFile(f); });
</script>
</body>
</html>
`
}
