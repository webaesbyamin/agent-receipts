import { BROWSER_VERIFY_JS } from './browser-verify.js'
import { BROWSER_RENDER_JS, RECEIPT_CSS } from './browser-render.js'

/**
 * The public verify page: one static HTML file. Someone drops a receipt.html
 * (or receipt.json) on it and the check runs in their browser. No upload,
 * no account, no server.
 *
 * The key inside a receipt only proves the receipt wasn't changed. To know
 * WHO signed it, compare the key ID with the one the issuer publishes; the
 * page has a field for that.
 */
export function renderVerifyPage(options: { title?: string } = {}): string {
  const title = options.title ?? 'Verify a receipt'
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light only">
<title>${title.replace(/</g, '&lt;')}</title>
<style>
${RECEIPT_CSS}
:root{color-scheme:light only;--ink:#1c1a16;--muted:#6d675c;--line:#e7e1d4;--good:#1f4d3a;--good-bg:#e8f0ea;--bad:#8a2a1d;--bad-bg:#f6e6e2}
*{box-sizing:border-box}
html{background:#f3efe6;-webkit-text-size-adjust:100%}
body{margin:0;color:var(--ink);background-color:#f3efe6;background-image:linear-gradient(180deg,#f7f4ec 0%,#efe9dc 100%);background-attachment:fixed;font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif;padding:max(28px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(32px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
main{max-width:620px;margin:0 auto}
h1{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-weight:500;font-size:32px;line-height:1.15;margin:0 0 8px}
.lead{color:#3c3830;margin:0 0 22px}
.drop{display:block;border:1.5px dashed #cfc7b6;border-radius:16px;padding:34px 18px;text-align:center;background-color:#fffefb;background-image:linear-gradient(180deg,#fffefb,#fbf8f1);cursor:pointer}
.drop.over{border-color:var(--good);background:#f2f7f3}
.drop strong{display:block;font-size:16px;margin-bottom:4px}
.drop span{color:var(--muted);font-size:13.5px}
input[type=file]{position:absolute;left:-9999px}
label.k{display:block;margin:20px 0 6px;font-size:12px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase}
input[type=text]{width:100%;font:13px ui-monospace,SFMono-Regular,Menlo,monospace;padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:#fffefb;color:var(--ink)}
.result{margin-top:22px;padding:18px;border-radius:14px;border:1px solid var(--line);background:#fffefb;display:none}
.result.ok{display:block;border-color:#c9dccf;background:var(--good-bg)}
.result.bad{display:block;border-color:#e8c9c2;background:var(--bad-bg)}
.result h2{margin:0 0 4px;font-size:18px;text-transform:none;letter-spacing:0;color:inherit}
.result.ok h2{color:var(--good)}.result.bad h2{color:var(--bad)}
.result p{margin:4px 0;overflow-wrap:anywhere}
dl{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin:14px 0 0}
dl div{min-width:0}
dt{font-size:12px;color:var(--muted)}
dd{margin:0;overflow-wrap:anywhere}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;word-break:break-all}
.fine{margin-top:28px;font-size:13px;color:var(--muted)}
#shown{margin-top:22px}
[hidden]{display:none!important}
</style>
</head>
<body>
<main>
  <h1>${title.replace(/</g, '&lt;')}</h1>
  <p class="lead">Drop a receipt here to check that nothing on it changed after it was signed. The check runs in your browser; the file never leaves your device.</p>

  <label class="drop" id="drop" for="file">
    <strong>Drop receipt.html or receipt.json</strong>
    <span>or tap to choose a file</span>
  </label>
  <input type="file" id="file" accept=".html,.htm,.json,application/json,text/html">

  <label class="k" for="expected">Issuer's key ID or public key (optional)</label>
  <input type="text" id="expected" placeholder="key_… or 64-character public key" autocomplete="off" spellcheck="false">

  <section class="result" id="result" aria-live="polite">
    <h2 id="r-title"></h2>
    <p id="r-sub"></p>
    <dl id="r-details"></dl>
  </section>

  <div class="sheet" id="shown" hidden></div>

  <p class="fine">Receipts are signed with Ed25519. A valid seal means the receipt is exactly as it was signed. To know who signed it, compare the key ID with the one the issuer publishes.</p>
</main>
<script>
${BROWSER_VERIFY_JS}
${BROWSER_RENDER_JS}
var lastFile = null;
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
function show(ok, title, sub, rows) {
  if (!ok) showReceipt(null, null);
  var box = document.getElementById('result');
  box.className = 'result ' + (ok ? 'ok' : 'bad');
  document.getElementById('r-title').textContent = title;
  document.getElementById('r-sub').textContent = sub;
  var dl = document.getElementById('r-details'); dl.innerHTML = '';
  (rows || []).forEach(function (r) {
    var d = document.createElement('div'); var dt = document.createElement('dt'); var dd = document.createElement('dd');
    dt.textContent = r[0]; dd.textContent = r[1]; if (r[2]) dd.className = 'mono'; d.appendChild(dt); d.appendChild(dd); dl.appendChild(d);
  });
}
async function check(text) {
  var data;
  try { data = arExtract(text); } catch (e) { show(false, 'Not a receipt', 'This file has no receipt data in it.'); return; }
  var expected = document.getElementById('expected').value.trim();
  var key = data.publicKey || (/^[0-9a-f]{64}$/i.test(expected) ? expected : null);
  if (!key) { show(false, 'Need a public key', 'This receipt file has no key in it. Paste the issuer\\'s 64-character public key above.'); return; }
  var r = await arVerify(data.receipt, key, { requireV2: false });
  var a = data.approval ? await arVerify(data.approval, key, { requireV2: true }) : null;
  var rows = [
    ['What', (data.receipt.metadata && data.receipt.metadata.recipe) || data.receipt.action],
    ['Status', data.receipt.status],
    ['Receipt', data.receipt.receipt_id, true],
    ['Signed by key', r.key_id || '—', true],
  ];
  if (data.receipt.output_summary) rows.splice(1, 0, ['Summary', data.receipt.output_summary]);
  var issuer = data.receipt.metadata && data.receipt.metadata.issuer;
  if (issuer && issuer.key_url) rows.push(['Issuer publishes keys at', issuer.key_url]);
  var keyNote = '';
  if (expected) {
    var expectedId = /^[0-9a-f]{64}$/i.test(expected) ? await arKeyId(expected) : expected;
    if (expectedId !== r.key_id) { show(false, 'Signed by a different key', 'The seal is intact, but it was signed by ' + (r.key_id || 'an unknown key') + ', not ' + expectedId + '.', rows); return; }
    keyNote = ' The key matches the one you entered.';
  } else {
    keyNote = ' To know who signed it, check that ' + r.key_id + ' is the key the issuer publishes.';
  }
  if (!r.valid) { show(false, 'Not verified', r.reason || 'The receipt could not be verified.', rows); return; }
  if (a && !a.valid) { show(false, 'Approval not verified', a.reason, rows); return; }
  if (a && a.valid && data.approval.parent_receipt_id !== data.receipt.receipt_id) { show(false, 'Approval not verified', 'The approval belongs to a different receipt.', rows); return; }
  var coverage = r.covers_all_fields ? 'Every detail on it is covered by the signature.' : 'Older receipt format: only 12 core fields are signed (summary, cost and files are not).';
  show(true, 'Verified', coverage + (a ? ' The approval is verified too.' : '') + keyNote, rows);
  showReceipt(data, { state: 'ok', title: 'Verified', sub: 'This is the signed record, shown by this page, not by the file.' });
}
function showReceipt(data, seal) {
  var el = document.getElementById('shown');
  if (!seal) { el.hidden = true; el.innerHTML = ''; return; }
  el.innerHTML = arRenderReceipt({ receipt: data.receipt, approval: data.approval || null, publicKey: data.publicKey }, seal);
  el.hidden = false;
}
function readFile(f) { lastFile = f; var fr = new FileReader(); fr.onload = function () { check(String(fr.result)); }; fr.readAsText(f); }
var drop = document.getElementById('drop');
document.getElementById('file').addEventListener('change', function (e) { if (e.target.files[0]) readFile(e.target.files[0]); });
document.getElementById('expected').addEventListener('input', function () { if (lastFile) readFile(lastFile); });
document.getElementById('file').addEventListener('click', function (e) { e.target.value = ''; });
['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
drop.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) readFile(f); });
</script>
</body>
</html>
`
}
