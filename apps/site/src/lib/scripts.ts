// The site's browser code, as inline scripts (no client components, no
// bundles). Everything is readable without it: tabs all show, links go to
// /install, and the signature stamp says it's checking.

/** Every page: copy buttons, tab groups, and the visitor's OS for install links and the install tabs. */
export const SITE_JS = `
(function () {
  function os() {
    var p = ((navigator.userAgentData && navigator.userAgentData.platform) || '') + ' ' + navigator.userAgent;
    if (/Windows|Win32|Win64/i.test(p)) return 'windows';
    if (/Android|iPhone|iPad|iPod/i.test(p)) return null;
    if (/Mac/i.test(p)) return 'mac';
    if (/Linux|X11|CrOS/i.test(p)) return 'linux';
    return null;
  }
  var mine = os();
  if (mine) document.querySelectorAll('[data-install-link]').forEach(function (a) { a.setAttribute('href', '/install#' + mine); });

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy]');
    if (!b) return;
    var text = b.closest('.code').querySelector('code').textContent;
    var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { b.textContent = 'Select and copy'; });
  });

  document.querySelectorAll('[data-tabs]').forEach(function (group) {
    var tabs = group.querySelectorAll('[role=tab]');
    var isOs = group.getAttribute('data-tabs') === 'os';
    function show(id, focus) {
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-tab') === id;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        if (on && focus) t.focus();
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        show(t.getAttribute('data-tab'));
        if (isOs) history.replaceState(null, '', '#' + t.getAttribute('data-tab'));
      });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { var n = tabs[(i + d + tabs.length) % tabs.length]; show(n.getAttribute('data-tab'), true); }
      });
    });
    var first = tabs[0].getAttribute('data-tab');
    if (!isOs) return show(first);
    var fromHash = location.hash.slice(1);
    show(['mac', 'windows', 'linux'].indexOf(fromHash) >= 0 ? fromHash : (mine || first));
  });
})();
`

/**
 * Home: the page signature. Collects the [data-signed] text exactly as
 * scripts/page-signature.mjs does at build time, hashes it, and checks the
 * embedded Ed25519 signature with WebCrypto. "Try to fake this page" makes that
 * text editable; "restore" puts back the copy kept in memory.
 */
export const PAGE_SIGNATURE_JS = `
(function () {
  var SIG = JSON.parse(document.getElementById('page-signature').textContent);
  var els = Array.prototype.slice.call(document.querySelectorAll('[data-signed]'));
  var originals = els.map(function (el) { return el.innerHTML; });
  var enc = new TextEncoder();
  var stamps = document.querySelectorAll('[data-stamp]');
  var hashOut = document.getElementById('sig-hash');
  var editing = false, seq = 0, keyPromise = null, lastState = null;

  function text() { return els.map(function (el) { return el.textContent.replace(/\\s+/g, ' ').trim(); }).join('\\n'); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function bytes(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }

  var COPY = {
    checking: ['Checking', 'your browser is checking the signature'],
    ok: ['Verified', 'Signed · unchanged'],
    void: ['Void', 'Changed after signing'],
    unsupported: ['Can’t check', 'Your browser can’t check Ed25519. Try a current Chrome, Safari or Firefox.'],
  };
  function show(state, digest) {
    if (digest) hashOut.textContent = digest;
    stamps.forEach(function (s) {
      s.setAttribute('data-state', state);
      s.querySelector('[data-stamp-word]').textContent = COPY[state][0];
      s.querySelector('[data-stamp-sub]').textContent = COPY[state][1];
      if (state !== lastState) { s.classList.remove('thump'); void s.offsetWidth; s.classList.add('thump'); }
    });
    lastState = state;
  }

  async function check() {
    var mine = ++seq;
    if (!window.crypto || !crypto.subtle || !SIG.signature) return show('unsupported');
    try {
      if (!keyPromise) keyPromise = crypto.subtle.importKey('raw', bytes(SIG.public_key), { name: 'Ed25519' }, false, ['verify']);
      var key = await keyPromise;
      var digest = hex(await crypto.subtle.digest('SHA-256', enc.encode(text())));
      var ok = await crypto.subtle.verify({ name: 'Ed25519' }, key, bytes(SIG.signature), enc.encode('agent-receipts-site:v1:' + SIG.path + ':' + digest));
      if (mine === seq) show(ok ? 'ok' : 'void', digest);
    } catch (e) {
      if (mine === seq) show('unsupported');
    }
  }

  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('editing', on);
    els.forEach(function (el) {
      if (on) { el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'false'); el.setAttribute('aria-describedby', 'edit-help'); }
      else { el.removeAttribute('contenteditable'); el.removeAttribute('aria-describedby'); }
    });
    document.querySelectorAll('[data-fake]').forEach(function (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.textContent = on ? 'stop editing' : 'try to fake this page'; });
    document.getElementById('editbar').hidden = !on;
  }

  document.addEventListener('input', function (e) { if (editing && e.target.closest && e.target.closest('[data-signed]')) check(); });
  document.querySelectorAll('[data-fake]').forEach(function (b) {
    b.addEventListener('click', function () {
      setEditing(!editing);
      if (editing) { var h = document.querySelector('h1[data-signed]'); h.focus(); }
    });
  });
  document.querySelectorAll('[data-restore]').forEach(function (b) {
    b.addEventListener('click', function () { els.forEach(function (el, i) { el.innerHTML = originals[i]; }); check(); });
  });

  // Is the embedded key the one this site publishes?
  var pub = document.getElementById('sig-published');
  fetch('/.well-known/agent-receipts-site.json').then(function (r) { return r.json(); }).then(function (j) {
    pub.textContent = j.public_key === SIG.public_key ? 'yes, the key matches' : 'no: this build used a local test key';
  }, function () { pub.textContent = 'couldn’t load the published key'; });

  check();
})();
`

/** Home: the early-access stub. Posts to /api/waitlist and shows its answer. */
export const STUB_JS = `
(function () {
  var form = document.getElementById('stub-form');
  var msg = document.getElementById('stub-msg');
  var done = document.getElementById('stub-done');
  var button = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = new FormData(form);
    var body = {};
    f.forEach(function (v, k) { body[k] = String(v); });
    msg.textContent = '';
    button.disabled = true;
    button.textContent = 'Handing it in…';
    var data = null;
    try {
      var res = await fetch('/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      data = await res.json();
    } catch (err) { data = { error: 'Couldn’t reach the waitlist. Try again.' }; }
    button.disabled = false;
    button.textContent = 'Hand in the stub';
    if (data && data.ok) {
      document.getElementById('stub-done-sub').textContent = data.status === 'existing' ? 'you’re already on the list' : 'check your email to confirm';
      form.hidden = true;
      done.hidden = false;
      done.focus();
    } else {
      msg.textContent = (data && data.error) || 'Something went wrong. Try again.';
    }
  });
})();
`
