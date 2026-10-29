/**
 * Renders a receipt's visible content in the browser FROM the signed data.
 *
 * Why in the browser: if the page's text were written separately from the
 * signed JSON, someone could edit the text and leave the JSON (and the seal)
 * intact. Rendering from the JSON means every word a person reads is a word
 * the signature covers. (Someone who rewrites this script can still fake a
 * page — that's why the public verify page, which renders with its own copy
 * of this code, is the independent check.)
 *
 * Plain JavaScript in a string so it can be inlined into self-contained
 * pages. Every value goes through arEsc before it reaches innerHTML.
 */
export const BROWSER_RENDER_JS = String.raw`
function arEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function arUrl(u) { return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null; }
function arBytes(n) { if (typeof n !== 'number') return '—'; if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
function arShort(h) { h = String(h || '').replace(/^sha256:/, ''); return h.length > 16 ? h.slice(0, 8) + '…' + h.slice(-6) : h; }
function arTime(iso, tz) {
  if (!iso) return '—';
  var d = new Date(iso); if (isNaN(d.getTime())) return String(iso);
  try { return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz || undefined, timeZoneName: 'short' }).format(d); }
  catch (e) { return d.toISOString(); }
}
function arDur(ms) { if (typeof ms !== 'number') return '—'; if (ms < 1000) return ms + ' ms'; var s = Math.round(ms / 1000); if (s < 60) return s + ' sec'; return Math.floor(s / 60) + ' min ' + (s % 60) + ' sec'; }
function arUsd(n) { if (typeof n !== 'number') return '—'; return n > 0 && n < 0.01 ? '< $0.01' : '$' + n.toFixed(2); }
function arNames(files) {
  var n = files.map(function (f) { return f.name; });
  if (n.length === 0) return 'Nothing';
  if (n.length === 1) return n[0];
  if (n.length <= 3) return n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
  return n.slice(0, 2).join(', ') + ' and ' + (n.length - 2) + ' more files';
}
function arFiles(title, files) {
  if (!files.length) return '';
  var rows = files.map(function (f) {
    return '<tr><td class="name">' + arEsc(f.name) + '</td><td class="num">' + arEsc(arBytes(f.bytes)) + '</td><td class="mono hash">' + arEsc(arShort(f.sha256)) + '</td></tr>';
  }).join('');
  return '<section class="block"><h2>' + arEsc(title) + '</h2><div class="scroll" tabindex="0" aria-label="' + arEsc(title) + '"><table><thead><tr><th>File</th><th class="num">Size</th><th>Fingerprint</th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="hint">Swipe to see fingerprints →</p></section>';
}
function arRecipeName(r) { var m = r.metadata || {}; return m.recipe || r.action; }
function arIsApprovalOf(a, r) {
  return !!a && !!r && a.parent_receipt_id === r.receipt_id && a.action === 'magic_folder.approved'
    && a.status === 'completed' && !!a.metadata && a.metadata.kind === 'magic_folder_approval' && a.key_id === r.key_id;
}
function arRenderReceipt(d, seal) {
  var r = d.receipt, a = d.approval, m = r.metadata || {}, tz = d.timeZone;
  var files = r.files || [];
  var inputs = files.filter(function (f) { return f.role === 'input'; });
  var outputs = files.filter(function (f) { return f.role === 'output'; });
  var ok = r.status === 'completed';
  var waiting = ok && m.needs_approval && !a;
  var issuer = (m.issuer && m.issuer.name) || 'Magic Folder';
  var recipe = arRecipeName(r);
  var err = r.error && typeof r.error.message === 'string' ? r.error.message : 'something went wrong.';
  if (!/[.!?]$/.test(err)) err += '.';
  var lead = ok
    ? arEsc(arNames(inputs)) + ' went into <strong>' + arEsc(recipe) + '</strong>. ' + arEsc(r.output_summary || '')
    : arEsc(arNames(inputs)) + ' went into <strong>' + arEsc(recipe) + '</strong>, but the job didn\'t finish: ' + arEsc(err) + ' Nothing was charged.';
  var pill = seal.state === 'bad' ? ['bad', 'Not verified'] : !ok ? ['bad', 'Did not finish'] : waiting ? ['wait', 'Waiting for your OK'] : ['good', 'Done'];
  if (seal.state === 'bad') lead = '<span class="warn">This receipt failed its check. Don\'t rely on anything below.</span> ' + lead;
  var details = [
    ['Started', arTime(r.timestamp, tz)],
    ['Finished', arTime(r.completed_at, tz)],
    ['Time taken', arDur(r.latency_ms)],
    ['Credits', ok ? String(m.credits == null ? 0 : m.credits) : '0'],
    ['Model', r.model || '—'],
    ['Model cost', typeof r.cost_usd === 'number' ? arUsd(r.cost_usd) + (m.cost_is_estimate ? ' (estimate)' : '') : '—'],
  ];
  if (a) details.push(['Approved', arTime(a.timestamp, tz)]);
  var verifyUrl = arUrl(d.verifyPageUrl);
  return ''
    + '<header class="top"><span class="issuer">' + arEsc(issuer) + '</span><span class="kind">Receipt</span></header>'
    + '<section class="hero"><span class="pill ' + pill[0] + '">' + pill[1] + '</span><h1>' + arEsc(recipe) + '</h1><p class="lead">' + lead + '</p></section>'
    + arFiles('What went in', inputs)
    + (ok ? arFiles('What came out', outputs) : '')
    + '<section class="block"><h2>Details</h2><dl class="grid">'
    + details.map(function (x) { return '<div class="cell"><dt>' + arEsc(x[0]) + '</dt><dd>' + arEsc(x[1]) + '</dd></div>'; }).join('')
    + '</dl></section>'
    + '<section class="seal" id="seal" data-state="' + arEsc(seal.state) + '"><div class="seal-mark" aria-hidden="true"></div><div class="seal-text"><p class="seal-title">' + arEsc(seal.title) + '</p><p class="seal-sub">' + arEsc(seal.sub) + '</p></div></section>'
    + '<section class="block fine"><h2>Check it yourself</h2><p>Every detail above comes from the signed record. Change one word and the seal breaks.</p>'
    + '<dl class="keys"><div class="cell"><dt>Receipt</dt><dd class="mono">' + arEsc(r.receipt_id) + '</dd></div>'
    + '<div class="cell"><dt>Signed by key</dt><dd class="mono">' + arEsc(r.key_id || '—') + '</dd></div>'
    + (d.publicKey ? '<div class="cell"><dt>Public key</dt><dd class="mono wrap">' + arEsc(d.publicKey) + '</dd></div>' : '')
    + (r.prev_receipt_hash ? '<div class="cell"><dt>Follows</dt><dd class="mono wrap">' + arEsc(arShort(r.prev_receipt_hash)) + '</dd></div>' : '')
    + '</dl>'
    + '<p>A file can\'t prove who made it. To confirm this came from ' + arEsc(issuer) + ', drop it on ' + arEsc(issuer) + '\'s own verify page'
    + (verifyUrl ? ' (<a href="' + arEsc(verifyUrl) + '" rel="noopener">this one</a>, if you got the link from them)' : '') + ', which checks the key for you.</p>'
    + '</section>'
    + '<footer class="foot">Agent Receipts · Ed25519 · receipt format v' + (r.sig_version === 2 ? 2 : 1) + '</footer>';
}
`

export const RECEIPT_CSS = `
:root{color-scheme:light only;--ink:#1c1a16;--muted:#6d675c;--line:#e7e1d4;--card:#fffefb;--good:#1f4d3a;--good-bg:#e8f0ea;--wait:#7a5a12;--wait-bg:#f6eedb;--bad:#8a2a1d;--bad-bg:#f6e6e2}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;background:#f3efe6}
body{margin:0;color:var(--ink);background-color:#f3efe6;background-image:linear-gradient(180deg,#f7f4ec 0%,#efe9dc 100%);background-attachment:fixed;font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif;padding:max(24px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(32px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
.sheet{max-width:620px;margin:0 auto;background-color:var(--card);background-image:linear-gradient(180deg,#fffefb 0%,#fdfbf6 100%);border:1px solid var(--line);border-radius:18px;padding:28px 24px 20px;box-shadow:0 1px 0 rgba(28,26,22,.03),0 18px 40px -24px rgba(28,26,22,.18)}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--line)}
.issuer{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-size:19px;letter-spacing:.01em;min-width:0;overflow-wrap:anywhere}
.kind{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.hero{padding:22px 0 6px}
h1{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;font-weight:500;font-size:30px;line-height:1.15;margin:12px 0 10px;overflow-wrap:anywhere}
.lead{margin:0;color:#34312b;font-size:16px;overflow-wrap:anywhere}
.pill{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.02em;padding:4px 10px;border-radius:999px}
.pill.good{color:var(--good);background:var(--good-bg)}.pill.wait{color:var(--wait);background:var(--wait-bg)}.pill.bad{color:var(--bad);background:var(--bad-bg)}
.block{padding:18px 0 4px;border-top:1px solid var(--line);margin-top:18px}
h2{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 10px}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:12px}
table{border-collapse:collapse;width:100%;min-width:440px;font-size:14px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
th{font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;background:#faf7f0}
td.name{overflow-wrap:anywhere}
.num{text-align:right;white-space:nowrap}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px}
.hash{white-space:nowrap;color:var(--muted)}
.hint{display:none;margin:6px 2px 0;font-size:12px;color:var(--muted)}
@media (max-width:520px){.hint{display:block}h1{font-size:26px}.sheet{padding:22px 18px 16px;border-radius:16px}}
.grid,.keys{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 20px;margin:0}
.keys{grid-template-columns:minmax(0,1fr);margin-bottom:14px}
.warn{display:block;margin-bottom:8px;color:var(--bad);font-weight:600}
.cell{min-width:0}
dt{font-size:12px;color:var(--muted)}
dd{margin:2px 0 0;overflow-wrap:anywhere}
.wrap{word-break:break-all}
.seal{display:flex;gap:14px;align-items:center;margin-top:22px;padding:16px;border-radius:14px;border:1px solid var(--line);background:#faf7f0}
.seal-mark{flex:0 0 40px;height:40px;border-radius:50%;border:2px solid var(--muted);position:relative}
.seal-text{min-width:0}
.seal-title{margin:0;font-weight:600;font-size:16px}
.seal-sub{margin:2px 0 0;color:var(--muted);font-size:13.5px;overflow-wrap:anywhere}
.seal[data-state=ok]{border-color:#c9dccf;background:var(--good-bg)}
.seal[data-state=ok] .seal-mark{border-color:var(--good);background:var(--good)}
.seal[data-state=ok] .seal-mark::after{content:"";position:absolute;left:13px;top:8px;width:9px;height:16px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}
.seal[data-state=ok] .seal-title{color:var(--good)}
.seal[data-state=warn]{border-color:#eadbb5;background:var(--wait-bg)}
.seal[data-state=warn] .seal-mark{border-color:var(--wait)}
.seal[data-state=warn] .seal-title{color:var(--wait)}
.seal[data-state=bad]{border-color:#e8c9c2;background:var(--bad-bg)}
.seal[data-state=bad] .seal-mark{border-color:var(--bad)}
.seal[data-state=bad] .seal-title{color:var(--bad)}
.fine p{margin:0 0 10px;color:#3c3830;font-size:14px}
a{color:var(--good)}
.foot{margin-top:22px;padding-top:14px;border-top:1px solid var(--line);font-size:11.5px;color:var(--muted);letter-spacing:.02em}
.noscript{max-width:620px;margin:0 auto;padding:18px;border:1px solid var(--line);border-radius:14px;background:#fffefb}
`
