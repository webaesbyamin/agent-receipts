export const GITHUB = 'https://github.com/webaesbyamin/agent-receipts'
export const VERIFY = 'https://verify.webaes.com'
export const DEMO = 'https://demo.receipts.webaes.com'

export function Nav({ home = true }: { home?: boolean }) {
  const h = home ? '' : '/'
  return (
    <header className="nav">
      <nav className="wrap" aria-label="Main">
        <a className="brand" href="/">Agent Receipts <span>by Webaes</span></a>
        <a href={`${h}#how`}>How it works</a>
        <a href={`${h}#try`}>Try it</a>
        <a href="/install" data-install-link>Install</a>
        <a href={`${h}#developers`}>Developers</a>
        <a className="out" href={VERIFY}>Verify a receipt</a>
      </nav>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <strong>Agent Receipts by Webaes</strong>
        <a href="https://webaes.com">webaes.com</a>
        <a href={GITHUB}>GitHub</a>
        <a href={VERIFY}>verify.webaes.com</a>
        <a href={`${GITHUB}/blob/main/LICENSE`}>Open source (MIT)</a>
      </div>
    </footer>
  )
}

/**
 * The only script most pages need: copy buttons, and picking the visitor's OS
 * for install links and the install tabs. Everything works without it
 * (all tabs show; links go to /install).
 */
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
    var text = b.parentNode.querySelector('code').textContent;
    var done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { b.textContent = 'Select and copy'; });
  });

  var tabs = document.querySelectorAll('[role=tab]');
  if (!tabs.length) return;
  function show(id, focus) {
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-os') === id;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { show(t.getAttribute('data-os')); history.replaceState(null, '', '#' + t.getAttribute('data-os')); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { var n = tabs[(i + d + tabs.length) % tabs.length]; show(n.getAttribute('data-os'), true); }
    });
  });
  var fromHash = location.hash.slice(1);
  show(['mac', 'windows', 'linux'].indexOf(fromHash) >= 0 ? fromHash : (mine || 'mac'));
})();
`
