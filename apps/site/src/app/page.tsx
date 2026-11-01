import type { Metadata } from 'next'
import product from '../generated/product.json'
import signature from '../generated/signature.json'
import { JOBS } from '../../content/jobs.mjs'
import { FINE_PRINT, plain } from '../../content/fine-print.mjs'
import { Code } from '../components/Code'
import { GITHUB, VERIFY } from '../components/Chrome'
import { PAGE_SIGNATURE_JS, STUB_JS } from '../lib/scripts'

// Everything marked data-signed is part of the page signature: its text is
// collected, hashed and signed at build time (scripts/build.mjs), and checked
// again by the visitor's browser (PAGE_SIGNATURE_JS). Never nest data-signed.

/** Webaes's public key, the one published at verify.webaes.com/.well-known/agent-receipts.json */
const WEBAES_KEY = 'b293d3f52ad15d278870eb07b63edbe82b697ad52c8a9232f1136ad2c7e623b6'

const receipt = product.receipt as unknown as { output_summary: string; model: string; metadata: { recipe: string } }

const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

const DEMO_JS = `
${product.verifyJs}
${product.renderJs}
(function () {
  var ORIGINAL = JSON.parse(document.getElementById('demo-receipt').textContent);
  var KEY = ${json(WEBAES_KEY)};
  var host = document.getElementById('receipt-host');
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  root.innerHTML = '<style>' + ${json(product.receiptCss.replace(':root{', ':host{'))} + '.sheet{margin:0}</style><article class="sheet"></article>';
  var sheet = root.querySelector('.sheet');
  var box = document.getElementById('summary');
  var status = document.getElementById('status');
  var seq = 0;
  async function check() {
    var mine = ++seq;
    var r = JSON.parse(JSON.stringify(ORIGINAL));
    r.output_summary = box.value;
    var res = null;
    try { res = await arVerify(r, KEY, { requireV2: true }); } catch (e) { res = null; }
    if (mine !== seq) return;
    var seal;
    if (!res || res.unsupported) seal = { state: 'warn', title: 'Your browser can’t check this signature', sub: 'Try a current Chrome, Safari, Edge or Firefox.' };
    else if (res.valid && res.key_id === r.key_id) seal = { state: 'ok', title: 'Verified, signed by Webaes', sub: 'Checked by your browser against Webaes’s published key.' };
    else seal = { state: 'bad', title: 'Not verified: this receipt was changed after it was signed', sub: 'The signature no longer matches what the receipt says.' };
    sheet.innerHTML = arRenderReceipt({ receipt: r, approval: null, publicKey: KEY, verifyPageUrl: ${json(VERIFY)} }, seal);
    status.setAttribute('data-state', seal.state);
    status.textContent = seal.title;
  }
  box.addEventListener('input', check);
  document.getElementById('reset').addEventListener('click', function () { box.value = ORIGINAL.output_summary; check(); box.focus(); });
  check();
})();
`

/** A margin note. On wide screens it sits beside main-column row `row`, pointing at it. */
function Note({ row, children }: { row: number; children: React.ReactNode }) {
  return <p className="mnote" style={{ '--row': row } as React.CSSProperties} data-signed>{children}</p>
}

/** name ........ value */
function Item({ name, value, big = false, rule = false }: { name: string; value: React.ReactNode; big?: boolean; rule?: boolean }) {
  return (
    <p className={['item', big && 'total', rule && 'rule'].filter(Boolean).join(' ')}>
      <span data-signed>{name}</span><span className="lead" aria-hidden="true" /><span className="val" data-signed>{value}</span>
    </p>
  )
}

function Section({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={className ? `sec ${className}` : 'sec'} aria-labelledby={`${id}-h`}>
      <hr className="perf" />
      <div className="wrap grid">{children}</div>
    </section>
  )
}

const AGENT_TABS = [
  { id: 'cc', name: 'claude code' },
  { id: 'cursor', name: 'cursor + desktop' },
  { id: 'sdk', name: 'sdk' },
]

const MCP_JSON = `{
  "mcpServers": {
    "agent-receipts": {
      "command": "npx",
      "args": ["@agent-receipts/mcp-server"]
    }
  }
}`

const PROXY_CMD = 'claude mcp add fs-receipted -- npx -y @agent-receipts/cli proxy --name fs -- npx -y @modelcontextprotocol/server-filesystem ~/Documents'

const SDK_JS = `import { AgentReceipts } from '@agent-receipts/sdk'

const ar = new AgentReceipts()

const receipt = await ar.track({
  action: 'summarize_brief',
  input: { file: 'brief.md' },
  output: { summary: 'Five tasks for the launch' },
})

const { verified } = await ar.verify(receipt.receipt_id)`


const ROLES = [['agency', 'agency'], ['freelancer', 'freelancer'], ['dev-team', 'dev team'], ['ai-product', 'building an AI product'], ['other', 'other']]
const PAY = [['monthly', 'yes, a monthly plan'], ['per-client', 'yes, priced per client'], ['maybe', 'maybe, depends on price'], ['no', 'no, just curious']]

const TITLE = 'Agent Receipts | Proof of Work for AI Agents | Webaes'
const DESCRIPTION = 'Signed receipts for what your AI agent did: files in and out, model, time and cost. Anyone can verify them offline. Free, open-source MCP server and SDK.'

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website', url: '/', siteName: 'Agent Receipts by Webaes', locale: 'en_US', title: TITLE, description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Your agent says it’s done. Prove it.' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og.png'] },
}

const SITE = 'https://receipts.webaes.com'
const ORG = 'https://www.webaes.com/#organization'
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['SoftwareApplication', 'SoftwareSourceCode'],
      '@id': `${SITE}/#software`,
      name: 'Agent Receipts',
      description: DESCRIPTION,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'macOS, Windows, Linux',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      license: 'https://opensource.org/licenses/MIT',
      url: `${SITE}/`,
      downloadUrl: 'https://www.npmjs.com/org/agent-receipts',
      codeRepository: GITHUB,
      programmingLanguage: 'TypeScript',
      publisher: { '@id': ORG },
    },
    {
      '@type': 'Organization',
      '@id': ORG,
      name: 'Webaes',
      url: 'https://webaes.com',
      logo: { '@type': 'ImageObject', url: 'https://www.webaes.com/redesign/img/webaes-logo.png' },
      sameAs: ['https://github.com/webaesbyamin', 'https://www.instagram.com/webaesbyamin/', 'https://www.tiktok.com/@webaesbyamin'],
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE}/#faq`,
      mainEntity: FINE_PRINT.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: plain(a) } })),
    },
  ],
}

export default function Home() {
  return (
    <main id="main" className="paper">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json(JSON_LD) }} />
      <p id="edit-help" className="sr-only">Editable for the signature test: change this text and the page signature check will fail.</p>

      <section className="hero" aria-labelledby="hero-h">
        <div className="wrap grid">
          <p className="rcpt-head full"><span data-signed>RCPT_SITE_HOME</span><span className="lead" aria-hidden="true" /><span data-signed>{product.builtOn}</span></p>
          <h1 id="hero-h" className="full" data-signed><span className="ln">Your agent</span> <span className="ln">says it’s done.</span> <span className="ln red">Prove it.</span></h1>
          <p className="sub" data-signed>Agent Receipts gives the work your AI agent does a signed receipt: what went in, what came out, what it cost. Anyone can check it, offline, without trusting you.</p>
          <div className="actions">
            <Code pill code="claude mcp add agent-receipts -- npx @agent-receipts/mcp-server" label="add Agent Receipts to Claude Code" />
            <button className="btn" type="button" data-fake aria-pressed="false">try to fake this page</button>
          </div>
          <Note row={3}>receipts are checked with a public key. no account, no server, no call home.</Note>
          <Note row={4}>one line adds it to claude code. the button makes this page editable.</Note>
        </div>
      </section>

      <Section id="records">
        <p className="label" data-signed>01 · The receipt</p>
        <h2 id="records-h" data-signed>What a receipt records.</h2>
        <Item name="files in, fingerprinted" value="sha256" />
        <Item name="files out" value="sha256" />
        <Item name="model that ran" value="id" />
        <Item name="time taken" value="ms" />
        <Item name="cost" value="USD" />
        <Item name="link to previous receipt" value="sha256" />
        <Item rule name="servers to trust" value="0" />
        <Item name="accounts needed" value="0" />
        <Item name="price" value="$0.00 · MIT" />
        <Item big name="Total" value="Proof" />
        <Note row={3}>sha256 of everything in and out. change one byte and it stops matching.</Note>
        <Note row={5}>logs are written by the agent. receipts are signed by the harness.</Note>
        <Note row={7}>in magic folder: claude’s estimate, or $0 on ollama.</Note>
        <Note row={8}>each receipt carries the hash of the one before it, so a missing one shows.</Note>
        <Note row={10}>checking needs the receipt and a public key. nothing else.</Note>
      </Section>

      <Section id="install">
        <p className="label" data-signed>02 · Install</p>
        <h2 id="install-h" data-signed>One line. Any agent.</h2>
        <div className="tabset">
          <div className="tabs" role="tablist" aria-label="Your agent" data-tabs="agent">
            {AGENT_TABS.map((t, i) => (
              <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} data-tab={t.id} aria-controls={`panel-${t.id}`} aria-selected={i === 0} tabIndex={i === 0 ? 0 : -1}>{t.name}</button>
            ))}
          </div>
          <div className="panel" role="tabpanel" id="panel-cc" aria-labelledby="tab-cc">
            <p data-signed>In a terminal:</p>
            <Code code="claude mcp add agent-receipts -- npx @agent-receipts/mcp-server" label="add Agent Receipts to Claude Code" />
          </div>
          <div className="panel" role="tabpanel" id="panel-cursor" aria-labelledby="tab-cursor">
            <p data-signed>Add this to <code>.cursor/mcp.json</code> in your project (Cursor), or to <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (Claude Desktop on a Mac), then restart it.</p>
            <Code code={MCP_JSON} label="MCP config for Cursor or Claude Desktop" />
          </div>
          <div className="panel" role="tabpanel" id="panel-sdk" aria-labelledby="tab-sdk">
            <p data-signed>Receipts from your own code:</p>
            <Code code="npm install @agent-receipts/sdk" label="install the SDK" />
            <Code code={SDK_JS} label="track and verify with the SDK" />
          </div>
        </div>
        <p data-signed>Your agent gets a <code>track_action</code> tool: each call comes back as a signed receipt, stored on your computer.</p>
        <div className="mini">
          <p data-signed>See them in a local dashboard:</p>
          <Code code="npx @agent-receipts/dashboard" label="start the local dashboard" />
        </div>
        <div className="mini">
          <p data-signed>Or get a receipt for every action, automatically. In Claude Code, every file edit and shell command:</p>
          <Code code="npx @agent-receipts/cli hooks install" label="sign every Claude Code action" />
          <p data-signed>Any MCP server, through the proxy. Each tool call is signed; every message passes through unchanged:</p>
          <Code code={PROXY_CMD} label="put an MCP server behind the receipts proxy" />
        </div>
        <Note row={3}>works with any MCP client.</Note>
        <Note row={4}>keys and receipts live in ~/.agent-receipts.</Note>
        <Note row={5}>the dashboard runs on your computer. nothing leaves it.</Note>
        <Note row={6}>signed as each tool finishes, outside the agent. hashes only: no commands, file contents or results.</Note>
      </Section>

      <Section id="magic-folder">
        <p className="label" data-signed>03 · Magic Folder</p>
        <h2 id="magic-folder-h" data-signed>Drop a file. Get the work back.</h2>
        <p data-signed>A folder on your computer that does real work. Drop a file into a job, and the result comes back in <em>Done</em> with a signed receipt.</p>
        <div className="listing">
          {product.recipes.map((r) => (
            <Item key={r.name} name={r.name} value={(JOBS[r.name as keyof typeof JOBS] as { short: string }).short} />
          ))}
        </div>
        <p className="go"><a className="btn ink" href="/install" data-install-link>install free <span aria-hidden="true">→</span></a> <span data-signed>mac · windows · linux</span></p>
        <Note row={3}>runs free on your computer with ollama, or on claude with your own api key.</Note>
        <Note row={4}>the client email waits in “needs your OK” until you approve it.</Note>
        <Note row={5}>the install steps run on clean mac, windows and linux machines on every change.</Note>
      </Section>

      <Section id="try">
        <p className="label" data-signed>04 · Try it on a real receipt</p>
        <h2 id="try-h" data-signed>Change one word. Watch it fail.</h2>
        <p data-signed>This is the receipt from a real job: a short note sent through <em>{receipt.metadata.recipe}</em> on a Mac. Edit its summary and your browser checks the signature again with every keystroke.</p>
        <div className="fake">
          <div className="editor">
            <label htmlFor="summary">The summary on this receipt</label>
            <textarea id="summary" defaultValue={receipt.output_summary} spellCheck={false} rows={5} />
            {/* The demo script writes this before React hydrates; React must leave it alone */}
            <div className="status" id="status" role="status" aria-live="polite" suppressHydrationWarning>Checking…</div>
            <button className="btn" type="button" id="reset">reset</button>
          </div>
          <div id="receipt-host" className="receipt-host" />
        </div>
        <script type="application/json" id="demo-receipt" dangerouslySetInnerHTML={{ __html: json(product.receipt) }} />
        <script dangerouslySetInnerHTML={{ __html: DEMO_JS }} />
        <Note row={3}>a real job, run on {receipt.model} on a Mac. the receipt is shown exactly as it was signed.</Note>
        <Note row={4}>checked against the key webaes publishes at verify.webaes.com. nothing is sent anywhere.</Note>
      </Section>

      <Section id="signature">
        <p className="label" data-signed>05 · Signature</p>
        <h2 id="signature-h" data-signed>This page is a receipt.</h2>
        <p data-signed>Every heading, paragraph, line item, note and command on this page was signed when the site was built. Your browser is checking that signature now. Press “try to fake this page”, change any word, and the stamp turns to VOID.</p>
        <dl className="sigfields">
          <div><dt>page text, sha256</dt><dd id="sig-hash" suppressHydrationWarning>{signature.sha256}</dd></div>
          <div><dt>signature, Ed25519</dt><dd>{signature.signature}</dd></div>
          <div><dt>key id</dt><dd>{signature.key_id}{signature.dev && ' (local test key)'}</dd></div>
          <div><dt>public key</dt><dd>{signature.public_key}</dd></div>
          <div><dt>published by this site?</dt><dd><span id="sig-published" suppressHydrationWarning>checking</span> · <a href="/.well-known/agent-receipts-site.json">/.well-known/agent-receipts-site.json</a></dd></div>
        </dl>
        <div className="stamp-wrap">
          <div className="stamp" data-stamp data-state="checking" role="status" aria-live="polite" suppressHydrationWarning>
            <span className="stamp-word" data-stamp-word suppressHydrationWarning>Checking</span>
            <span className="stamp-sub" data-stamp-sub suppressHydrationWarning>your browser is checking the signature</span>
          </div>
          <div className="stamp-actions">
            <button className="btn" type="button" data-fake aria-pressed="false">try to fake this page</button>
            <button className="btn red" type="button" data-restore>restore the original</button>
          </div>
        </div>
        <script type="application/json" id="page-signature" dangerouslySetInnerHTML={{ __html: json(signature) }} />
        <Note row={3}>the signature check runs in your browser, with WebCrypto.</Note>
        <Note row={4}>a key just for this site. it isn’t the key that signs magic folder jobs.</Note>
      </Section>

      <section id="stub" className="sec stub" aria-labelledby="stub-h">
        <div className="tear-here" aria-hidden="true"><span>✂ tear here</span></div>
        <div className="wrap stub-grid">
          <div className="stub-copy">
            <p className="label" data-signed>Stub · Early access</p>
            <h2 id="stub-h" data-signed>Hand your clients a receipt.</h2>
            <p data-signed>For agencies and studios delivering AI work: your name on every receipt, a verify page on your domain, and a portal where clients see every job and its proof. Not built yet. We’ll build it if enough of you want it.</p>
          </div>
          <div className="stub-form">
            <form id="stub-form">
              <label className="field" htmlFor="stub-email"><span>email</span>
                <input id="stub-email" name="email" type="email" required autoComplete="email" />
              </label>
              <fieldset className="choices">
                <legend>you are</legend>
                {ROLES.map(([v, l]) => <label key={v}><input type="radio" name="role" value={v} /><span>{l}</span></label>)}
              </fieldset>
              <fieldset className="choices">
                <legend>would you pay?</legend>
                {PAY.map(([v, l]) => <label key={v}><input type="radio" name="pay" value={v} /><span>{l}</span></label>)}
              </fieldset>
              <label className="field" htmlFor="stub-worth"><span>worth per month <em>(optional)</em></span>
                <span className="money"><span aria-hidden="true">$</span><input id="stub-worth" name="worth" type="text" inputMode="decimal" maxLength={12} /></span>
              </label>
              <label className="field" htmlFor="stub-use"><span>receipts for what? <em>(optional)</em></span>
                <input id="stub-use" name="use" type="text" maxLength={300} />
              </label>
              <div className="hp" aria-hidden="true"><label>leave this empty<input name="hp_token" type="text" tabIndex={-1} autoComplete="off" /></label></div>
              <button className="btn red big" type="submit">Hand in the stub</button>
              <p className="fine">one email when it’s real · nothing else</p>
              <p id="stub-msg" className="stub-msg" role="alert" />
            </form>
            <div id="stub-done" className="stub-done" hidden tabIndex={-1}>
              <div className="stamp" data-state="ok"><span className="stamp-word">Received</span><span className="stamp-sub" id="stub-done-sub">check your email to confirm</span></div>
            </div>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: STUB_JS }} />
      </section>

      <Section id="fine-print" className="fine-print">
        <p className="label" data-signed>06 · Fine print</p>
        <h2 id="fine-print-h" data-signed>Terms of this receipt.</h2>
        <ol className="terms">
          {FINE_PRINT.map(([q, a]) => <li key={q}><strong data-signed>{q}</strong> <span data-signed dangerouslySetInnerHTML={{ __html: a }} /></li>)}
        </ol>
      </Section>

      <div id="editbar" className="editbar" hidden>
        <span className="stamp mini" data-stamp data-state="checking" suppressHydrationWarning><span className="stamp-word" data-stamp-word suppressHydrationWarning>Checking</span><span className="stamp-sub" data-stamp-sub suppressHydrationWarning>checking</span></span>
        <button className="btn red" type="button" data-restore>restore the original</button>
        <button className="btn" type="button" data-fake aria-pressed="true">stop editing</button>
      </div>
      <script dangerouslySetInnerHTML={{ __html: PAGE_SIGNATURE_JS }} />
    </main>
  )
}
