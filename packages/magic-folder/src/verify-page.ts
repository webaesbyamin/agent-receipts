import { BROWSER_VERIFY_JS } from './browser-verify.js'
import { BROWSER_RENDER_JS, RECEIPT_CSS } from './browser-render.js'
import { computeKeyId } from '@agent-receipts/crypto'
import { jsonForScript } from './render.js'

export interface TrustedKey {
  /** Who this key belongs to, e.g. "Webaes" */
  name: string
  /** key_… id (from `magic-folder key`). Optional when publicKey is given. */
  keyId?: string
  /**
   * The 64-hex public key. With it, the page can also check receipt.json
   * files (which carry no key of their own).
   */
  publicKey?: string
}

/**
 * Optional branding for an issuer's own verify page. Leave it out and the page
 * is the neutral one, unchanged. Every value is checked or escaped before it
 * goes into the HTML: colours must be hex, URLs http(s) or a /path, font
 * names plain text, and font CSS can't close the <style> element.
 */
export interface VerifyPageTheme {
  /** The visible page heading, when it should differ from the <title> */
  heading?: string
  /** Wordmark text in the header band, e.g. "Webaes" */
  brandName?: string
  /** Wordmark's small second line, e.g. "verify.webaes.com" */
  brandSub?: string
  /** Where the wordmark links */
  homeUrl?: string
  /** Focus rings, the drop zone highlight and the invalid state's edge */
  accent?: string
  /** Text, and the header band */
  ink?: string
  /** Page background */
  paper?: string
  fontDisplay?: string
  fontBody?: string
  fontMono?: string
  /** A stylesheet URL (linked) or CSS text such as @font-face rules (inlined) */
  fontCss?: string
  /** Favicon: an .svg, .ico or .png URL */
  icon?: string
  /** apple-touch-icon URL */
  appleIcon?: string
  themeColor?: string
  description?: string
  /** Absolute URL of a 1200×630 share image */
  ogImage?: string
  /** Absolute URL of this page */
  canonical?: string
  /** Footer links */
  links?: Array<{ label: string; url: string }>
}

export interface VerifyPageOptions {
  title?: string
  theme?: VerifyPageTheme
  /**
   * Keys this page vouches for. An issuer hosts a copy of this page with its
   * own key baked in; receipts signed by that key show "Verified — signed by
   * <name>". With no trusted keys (the generic page), a receipt is only shown
   * as verified when the visitor enters the key (there is no ?key= link option).
   */
  trustedKeys?: TrustedKey[]
}

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function themeColor(name: string, v: string): string {
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) throw new Error(`${name} must be a hex colour like #0b0b0b, not ${JSON.stringify(v)}`)
  return v
}
function themeUrl(name: string, v: string): string {
  // A /path is local; //host would load from another site
  if (!/^(?:https?:\/\/[^\s"'<>`]+|\/(?!\/)[^\s"'<>`]*)$/.test(v)) throw new Error(`${name} must be an http(s) URL or a /path, not ${JSON.stringify(v)}`)
  return escAttr(v)
}
function themeFont(name: string, v: string): string {
  if (!/^[A-Za-z0-9 ,'"_-]+$/.test(v)) throw new Error(`${name} may only contain font names, commas and quotes, not ${JSON.stringify(v)}`)
  return v
}

/** The extra head tags, CSS, header band and footer for a themed page ('' each when there's no theme). */
function themeParts(t: VerifyPageTheme | undefined, title: string) {
  if (!t || !Object.values(t).some((v) => v !== undefined && v !== '')) return { head: '', css: '', header: '', footer: '' }
  const ink = themeColor('ink', t.ink ?? '#1c1a16')
  const paper = themeColor('paper', t.paper ?? '#f3efe6')
  const accent = themeColor('accent', t.accent ?? '#1f4d3a')
  const fd = themeFont('font-display', t.fontDisplay ?? 'Georgia, serif')
  const fb = themeFont('font-body', t.fontBody ?? '-apple-system, "Segoe UI", Helvetica, Arial, sans-serif')
  const fm = themeFont('font-mono', t.fontMono ?? 'ui-monospace, Menlo, Consolas, monospace')
  let fontLink = '', fontRules = ''
  if (t.fontCss) {
    if (/^(?:https?:\/\/|\/)[^\s{]*$/.test(t.fontCss.trim())) fontLink = `<link rel="stylesheet" href="${themeUrl('font-css', t.fontCss.trim())}">\n`
    else if (t.fontCss.includes('<')) throw new Error('font-css must be a stylesheet URL or plain CSS (no "<")')
    else fontRules = t.fontCss.trim() + '\n'
  }
  const title_ = escAttr(title)
  const description = t.description ? escAttr(t.description) : null
  const canonical = t.canonical ? themeUrl('canonical', t.canonical) : null
  const image = t.ogImage ? themeUrl('og-image', t.ogImage) : null
  const head = [
    description && `<meta name="description" content="${description}">`,
    canonical && `<link rel="canonical" href="${canonical}">`,
    t.themeColor && `<meta name="theme-color" content="${themeColor('theme-color', t.themeColor)}">`,
    t.icon && `<link rel="icon" href="${themeUrl('icon', t.icon)}"${t.icon.endsWith('.svg') ? ' type="image/svg+xml"' : ''}>`,
    t.appleIcon && `<link rel="apple-touch-icon" href="${themeUrl('apple-icon', t.appleIcon)}">`,
    (description || image) && `<meta property="og:type" content="website">`,
    (description || image) && `<meta property="og:title" content="${title_}">`,
    description && `<meta property="og:description" content="${description}">`,
    canonical && (description || image) && `<meta property="og:url" content="${canonical}">`,
    image && `<meta property="og:image" content="${image}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">`,
    (description || image) && `<meta property="og:locale" content="en_US">`,
    image && `<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${title_}">`,
    image && description && `<meta name="twitter:description" content="${description}">`,
    image && `<meta name="twitter:image" content="${image}">`,
  ].filter(Boolean).map((l) => l + '\n').join('') + fontLink
  const css = `${fontRules}:root{--ink:${ink};--paper:${paper};--accent:${accent};--fd:${fd};--fb:${fb};--fm:${fm}}
html{background:var(--ink)}
body{padding:0;color:var(--ink);background-color:var(--paper);background-image:linear-gradient(var(--paper),var(--paper));background-attachment:scroll;font-family:var(--fb);min-height:100vh;display:flex;flex-direction:column}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.band{background-color:var(--ink);background-image:linear-gradient(var(--ink),var(--ink));color:var(--paper);padding:max(10px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) 6px max(20px,env(safe-area-inset-left))}
.mark{display:inline-flex;align-items:center;gap:10px;min-height:44px;color:inherit;text-decoration:none}
.mark b{font:900 22px/1 var(--fd);text-transform:uppercase;letter-spacing:-.01em}
.mark span{font:400 13px/1 var(--fm);color:#d8d5ce}
.torn{height:16px;background-color:var(--ink);background-image:linear-gradient(45deg,var(--paper) 50%,transparent 50%),linear-gradient(-45deg,var(--paper) 50%,transparent 50%);background-size:16px 16px;background-repeat:repeat-x;background-position:0 100%}
.torn.end{transform:rotate(180deg);margin-bottom:-1px}
main{flex:1 0 auto;width:100%;max-width:660px;box-sizing:border-box;padding:28px max(20px,env(safe-area-inset-right)) 48px max(20px,env(safe-area-inset-left))}
.page-title{font:900 clamp(38px,10vw,60px)/.92 var(--fd);text-transform:uppercase;letter-spacing:-.015em;margin:0 0 16px}
.page-lead{color:var(--ink);font-size:17px}
.drop{border:2px dashed var(--ink);border-radius:0;background-color:#fff;background-image:linear-gradient(#fff,#fff)}
.drop.over{border-color:var(--accent);background:#fff}
.drop:focus-visible{outline-color:var(--accent)}
.nojs{border-radius:0}
.drop strong{font:500 16px var(--fm)}
.trusted,.fine{color:var(--ink)}
.mono,input[type=text]{font-family:var(--fm)}
.result{border-radius:0;border-width:1px 1px 1px 6px}
.result.bad{border-left-color:var(--accent)}
.sheet{border-radius:0}
.sheet .issuer,.sheet h1{font-family:var(--fb);font-weight:500}
.site-foot{background-color:var(--ink);background-image:linear-gradient(var(--ink),var(--ink));padding:18px max(20px,env(safe-area-inset-right)) max(28px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left))}
.site-foot nav{max-width:620px;margin:0 auto;display:flex;flex-wrap:wrap;gap:0 4px}
.site-foot a{display:inline-flex;align-items:center;min-height:44px;padding:0 10px;font:400 15px var(--fm);color:#d8d5ce;text-decoration:none}
.site-foot a:hover{color:var(--paper);text-decoration:underline}
.site-foot :focus-visible{outline-color:var(--paper)}
`
  const brand = t.brandName ? `<b>${escAttr(t.brandName)}</b>${t.brandSub ? ` <span>${escAttr(t.brandSub)}</span>` : ''}` : ''
  const header = brand
    ? `<header class="band">${t.homeUrl ? `<a class="mark" href="${themeUrl('home-url', t.homeUrl)}">${brand}</a>` : `<span class="mark">${brand}</span>`}</header>\n<div class="torn" aria-hidden="true"></div>\n`
    : ''
  const links = (t.links ?? []).map((l) => `<a href="${themeUrl('link', l.url)}">${escAttr(l.label)}</a>`).join('')
  const footer = links ? `<div class="torn end" aria-hidden="true"></div>\n<footer class="site-foot"><nav aria-label="Links">${links}</nav></footer>\n` : ''
  return { head, css, header, footer }
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
    const publicKey = k.publicKey?.toLowerCase()
    if (publicKey !== undefined && !/^[0-9a-f]{64}$/.test(publicKey)) throw new Error(`Not a public key: ${k.publicKey}`)
    const keyId = k.keyId ?? (publicKey ? computeKeyId(publicKey) : undefined)
    if (!keyId || !/^key_[0-9a-f]{16}$/.test(keyId)) throw new Error(`Not a key id: ${k.keyId}`)
    if (publicKey && computeKeyId(publicKey) !== keyId) throw new Error(`Public key does not match ${keyId}`)
    return { name: k.name, keyId, publicKey: publicKey ?? null }
  })
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  // A page with built-in keys only ever trusts those, so it has no key box.
  const keyInput = trusted.length ? '' : `  <label class="k" for="expected">Signer's key ID or public key</label>
  <input type="text" id="expected" placeholder="key_… or 64-character public key" autocomplete="off" spellcheck="false">
`
  const trustedBy = trusted.length ? 'one this page vouches for' : 'one this page vouches for, or one you entered above'
  const theme = themeParts(options.theme, title)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light only">
<title>${safeTitle}</title>
${theme.head}<style>
${RECEIPT_CSS}
main{max-width:620px;margin:0 auto}
.page-title{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-weight:500;font-size:32px;line-height:1.15;margin:0 0 8px}
.page-lead{color:#3c3830;margin:0 0 22px}
.drop{display:block;width:100%;font:inherit;color:inherit;text-align:center;-webkit-appearance:none;appearance:none;border:1.5px dashed #cfc7b6;border-radius:16px;padding:34px 18px;text-align:center;background-color:#fffefb;background-image:linear-gradient(180deg,#fffefb,#fbf8f1);cursor:pointer}
.drop.over{border-color:var(--good);background:#f2f7f3}
.drop:focus-visible{outline:3px solid var(--good);outline-offset:3px}
.nojs{margin:18px 0 0;padding:14px 16px;border-radius:12px;border:1px solid #eadbb5;background:var(--wait-bg);color:var(--wait)}
.result:focus{outline:none}
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
${theme.css}</style>
</head>
<body>
${theme.header}<main>
  <h1 class="page-title">${options.theme?.heading ? escAttr(options.theme.heading) : safeTitle}</h1>
  <p class="page-lead">Drop a receipt here to check it. The check runs in your browser; the file never leaves your device.</p>

  <button type="button" class="drop" id="drop">
    <strong>Drop receipt.html or receipt.json</strong>
    <span>or tap to choose a file</span>
  </button>
  <input type="file" id="file" tabindex="-1" aria-label="Receipt file to check" accept=".html,.htm,.json,application/json,text/html">
  <noscript><p class="nojs">This page checks receipts with JavaScript, in your browser. Turn JavaScript on to use it. Nothing is uploaded either way.</p></noscript>

  <p class="trusted" id="trusted-note" hidden></p>
${keyInput}
  <section class="result" id="result" aria-live="polite" tabindex="-1">
    <h2 id="r-title"></h2>
    <p id="r-sub"></p>
    <dl id="r-details"></dl>
  </section>

  <div class="sheet" id="shown" hidden></div>

  <p class="fine">Receipts are signed with Ed25519, a standard kind of digital signature. A valid signature proves the receipt is exactly as it was signed. It proves who signed it only when the signing key is one you trust: ${trustedBy}.</p>
</main>
${theme.footer}<script type="application/json" id="trusted-keys">${jsonForScript(trusted)}</script>
<script>
${BROWSER_VERIFY_JS}
${BROWSER_RENDER_JS}
var TRUSTED = JSON.parse(document.getElementById('trusted-keys').textContent);
var lastFile = null;
var expectedInput = document.getElementById('expected');
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
  box.focus();
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
  try { data = arExtract(text); } catch (e) { show('warn', 'Not a receipt', 'This file has no receipt data in it. Choose the receipt.html or receipt.json from a job\\'s folder.'); return; }
  if (!data || !data.receipt || typeof data.receipt !== 'object') { show('warn', 'Not a receipt', 'This file has no receipt data in it. Choose the receipt.html or receipt.json from a job\\'s folder.'); return; }
  var expected = expectedInput ? expectedInput.value.trim() : '';
  // A receipt.json carries no key: use the trusted key it names, or a typed public key.
  var named = null;
  for (var t = 0; t < TRUSTED.length; t++) if (TRUSTED[t].publicKey && TRUSTED[t].keyId === data.receipt.key_id) named = TRUSTED[t].publicKey;
  var key = data.publicKey || named || (/^[0-9a-f]{64}$/i.test(expected) ? expected : null);
  if (!key && TRUSTED.length) {
    var known = TRUSTED.map(function (k) { return k.name; }).join(' or ');
    show('bad', 'Not signed by ' + known, 'This receipt was signed by ' + (data.receipt.key_id || 'an unknown key') + ', which is not ' + known + '\\'s key. Treat it as not genuine.');
    return;
  }
  if (!key) { show('bad', 'Need a public key', 'This receipt file has no key in it. Paste the signer\\'s 64-character public key above.'); return; }
  var r = await arVerify(data.receipt, key, { requireV2: false });
  if (r.unsupported) { show('warn', 'Your browser can\\'t check Ed25519', 'Try a current Chrome, Safari or Firefox. Nothing was checked, so this is not a result either way.'); return; }
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
    if (a.unsupported) { show('warn', 'Your browser can\\'t check Ed25519', 'Try a current Chrome, Safari or Firefox. Nothing was checked, so this is not a result either way.'); return; }
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
var MAX_BYTES = 5 * 1024 * 1024;
function readFile(f) {
  lastFile = f;
  showReceipt(null, null);
  if (f.size > MAX_BYTES) { show('warn', 'Too big to be a receipt', 'This file is ' + (f.size / 1048576).toFixed(1) + ' MB. A receipt is a small file, usually under 100 KB.'); return; }
  var fr = new FileReader();
  fr.onload = function () { check(String(fr.result)); };
  fr.onerror = function () { show('warn', 'Couldn\\'t read that file', 'Try choosing it again.'); };
  fr.readAsText(f);
}
function readFiles(files) {
  if (!files || !files.length) return;
  if (files.length > 1) { lastFile = null; showReceipt(null, null); show('warn', 'One receipt at a time', 'You chose ' + files.length + ' files. Drop or choose a single receipt.html or receipt.json.'); return; }
  readFile(files[0]);
}
var drop = document.getElementById('drop');
drop.addEventListener('click', function () { document.getElementById('file').click(); });
document.getElementById('file').addEventListener('change', function (e) { readFiles(e.target.files); });
document.getElementById('file').addEventListener('click', function (e) { e.target.value = ''; });
if (expectedInput) expectedInput.addEventListener('input', function () { if (lastFile) readFile(lastFile); });
['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
drop.addEventListener('drop', function (e) { readFiles(e.dataTransfer && e.dataTransfer.files); });
</script>
</body>
</html>
`
}
