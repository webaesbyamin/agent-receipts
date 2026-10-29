import product from '../generated/product.json'
import { JOBS } from '../../content/jobs.mjs'
import { Code } from '../components/Code'
import { Nav, Footer, GITHUB, VERIFY, DEMO } from '../components/Chrome'

/** Webaes's public key, the one published at verify.webaes.com/.well-known/agent-receipts.json */
const WEBAES_KEY = 'b293d3f52ad15d278870eb07b63edbe82b697ad52c8a9232f1136ad2c7e623b6'

const receipt = product.receipt as unknown as {
  receipt_id: string; key_id: string; output_summary: string; latency_ms: number; model: string
  metadata: { job_id: string; recipe: string; issuer: { name: string } }
  files: Array<{ name: string; role: string }>
}

function duration(ms: number): string {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s} sec` : `${Math.floor(s / 60)} min ${s % 60} sec`
}

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
    if (!res) seal = { state: 'warn', title: 'Your browser can’t check this signature', sub: 'Try a current Chrome, Safari, Edge or Firefox.' };
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

const FAQ: Array<[string, React.ReactNode]> = [
  ['Is my data sent anywhere?', <>Not with Ollama: the AI runs on your computer, and your files stay in your Magic Folder. If you choose Claude instead, the files for that job are sent to Anthropic’s API with your own key. Checking a receipt, here or on a verify page, happens in your browser; nothing is uploaded.</>],
  ['What if a job fails?', <>You still get a signed receipt that says why it failed, your original comes back untouched in <em>Done</em>, and the job costs nothing.</>],
  ['Which computers does it run on?', <>Mac, Windows and Linux, with Node.js 22 or 24. The <a href="/install">install guide</a> walks through each one.</>],
  ['Do I need an AI subscription?', <>No. With Ollama, a free program, jobs run on your own computer. Claude is optional, with your own Anthropic API key.</>],
  ['What does it cost?', <>Nothing. Magic Folder and Agent Receipts are free and open source under the MIT licence.</>],
  ['Where do I get help?', <>Open an issue on <a href={`${GITHUB}/issues`}>GitHub</a>.</>],
]

export default function Home() {
  const inputs = receipt.files.filter((f) => f.role === 'input')
  const outputs = receipt.files.filter((f) => f.role === 'output')
  return (
    <>
      <Nav />
      <main id="main">
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <p className="kicker">Magic Folder · Agent Receipts</p>
              <h1>Drop a file. Get the work back, with a receipt anyone can check.</h1>
              <p className="lede">Magic Folder is a folder on your computer that does real work, like fixing typos, writing product descriptions or turning notes into tasks. Every job comes back with a signed receipt showing what went in, what came out and what it cost. Change one word and the seal breaks.</p>
              <div className="btns">
                <a className="btn primary" href="/install" data-install-link>Install free</a>
                <a className="btn" href="#how">See how it works</a>
              </div>
              <p className="small">Free and open source · Mac, Windows, Linux · Runs on your computer</p>
            </div>

            <div className="hv" aria-label="A file dropped into Fix typos comes back in Done with a signed receipt">
              <div className="hv-win">
                <div className="hv-bar"><i /><i /><i /><b>Magic Folder</b></div>
                <ul className="hv-list">
                  {product.recipes.map((r) => (
                    <li key={r.name} className={r.name === receipt.metadata.recipe ? 'on' : undefined}>
                      <span className="fi" aria-hidden="true" /><span>{r.name}</span>
                      {r.name === receipt.metadata.recipe && <em className="chip">{inputs[0]?.name}</em>}
                    </li>
                  ))}
                  <li><span className="fi" aria-hidden="true" /><span>Done</span></li>
                  <li><span className="fi" aria-hidden="true" /><span>Needs your OK</span></li>
                </ul>
              </div>
              <div className="hv-win hv-done">
                <div className="hv-bar"><i /><i /><i /><b>Done › {receipt.metadata.job_id}</b></div>
                <ul className="hv-list">
                  <li><span className="fi" aria-hidden="true" /><span>result</span><span className="muted">&nbsp;· {outputs.map((f) => f.name).join(', ')}</span></li>
                  <li><span className="fi" aria-hidden="true" /><span>original</span><span className="muted">&nbsp;· untouched</span></li>
                  <li><span className="doc r" aria-hidden="true" /><span>receipt.html</span></li>
                  <li><span className="doc" aria-hidden="true" /><span>receipt.json</span></li>
                </ul>
              </div>
              <div className="hv-mini">
                <div className="top">{receipt.metadata.issuer.name}<span>RECEIPT</span></div>
                <p className="hv-title">{receipt.metadata.recipe}</p>
                <p>{duration(receipt.latency_ms)} · {receipt.model} · Free (ran on this computer)</p>
                <div className="seal-row"><span className="seal-dot" aria-hidden="true" />Verified, signed by {receipt.metadata.issuer.name}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <div className="wrap">
            <p className="kicker">How it works</p>
            <h2>A folder that does the job, and shows its work.</h2>
            <div className="grid3">
              <div className="card"><span className="num">1</span><h3>Drop it into the job you want</h3><p>Your Magic Folder has a folder for each job, like <em>Fix typos</em> or <em>Meeting notes to tasks</em>. Drop a file in.</p></div>
              <div className="card"><span className="num">2</span><h3>Leave it</h3><p>Your file moves out of the job folder at once, and a “working” note takes its place until the job is done. You don’t need to do anything.</p></div>
              <div className="card"><span className="num">3</span><h3>Open Done</h3><p>The result, your original (untouched) and a receipt land together in <em>Done</em>, in their own folder.</p></div>
            </div>
            <p className="note">Some jobs, like a client email, wait in <em>Needs your OK</em> first. Check the draft, then move it to <em>Done</em> to approve it. The approval gets its own signed receipt.</p>
          </div>
        </section>

        <section className="section" id="jobs">
          <div className="wrap">
            <p className="kicker">The jobs it comes with</p>
            <h2>Six jobs, ready on day one.</h2>
            <div className="grid3">
              {product.recipes.map((r) => {
                const j = JOBS[r.name as keyof typeof JOBS] as { in: string; out: string; note?: string }
                return (
                  <article className="card job" key={r.name}>
                    <h3>{r.name}{r.needsApproval && <span className="tag">Needs your OK</span>}</h3>
                    <dl>
                      <div><dt>Drop in</dt><dd>{j.in}</dd></div>
                      <div><dt>You get</dt><dd>{j.out}</dd></div>
                    </dl>
                    {j.note && <p className="tip">{j.note}</p>}
                    <details><summary>Read the instructions it follows</summary><pre>{r.instruction}</pre></details>
                  </article>
                )
              })}
            </div>
            <p className="note"><strong>Make your own job:</strong> copy a job folder, rename it, and edit the one hidden text file inside that says what to do.</p>
          </div>
        </section>

        <section className="section" id="try">
          <div className="wrap">
            <p className="kicker">Try to fake it</p>
            <h2>Change one word. Watch the seal break.</h2>
            <p className="lede">This is the receipt from a real job: a short note sent through <em>Fix typos</em> on a Mac. Edit its summary and your browser checks the signature again with every keystroke.</p>
            <div className="fake">
              <div className="editor">
                <label htmlFor="summary">The summary on this receipt</label>
                <textarea id="summary" defaultValue={receipt.output_summary} spellCheck={false} />
                {/* The demo script writes this before React hydrates; React must leave it alone */}
                <div className="status" id="status" role="status" aria-live="polite" suppressHydrationWarning>Checking…</div>
                <button className="btn" type="button" id="reset">Reset</button>
                <p className="caption">A real receipt from a real job. Your browser checks the signature itself. Nothing is sent anywhere.</p>
              </div>
              <div id="receipt-host" className="receipt-host" />
            </div>
            <script type="application/json" id="demo-receipt" dangerouslySetInnerHTML={{ __html: json(product.receipt) }} />
            <script dangerouslySetInnerHTML={{ __html: DEMO_JS }} />
          </div>
        </section>

        <section className="section" id="proves">
          <div className="wrap">
            <p className="kicker">What a receipt proves</p>
            <h2>Three things you can check, without trusting anyone.</h2>
            <div className="grid3">
              <div className="card"><h3>What was done</h3><p>The files that went in and came out, each with a fingerprint. If a file changes by one byte, its fingerprint no longer matches.</p></div>
              <div className="card"><h3>When, how long, what it cost</h3><p>Start and finish times, the model, and the cost, recorded by the program that ran the job, not by the AI.</p></div>
              <div className="card"><h3>Who signed it</h3><p>Every receipt is signed. A verify page checks the signature against the issuer’s published key, so you know it came from them.</p></div>
            </div>
            <p className="note">A receipt proves what happened and that nothing changed since. It doesn’t prove the work is good. That’s still your call.</p>
          </div>
        </section>

        <section className="section" id="free">
          <div className="wrap narrow">
            <p className="kicker">Free on your computer</p>
            <h2>Runs on your own machine.</h2>
            <p className="lede">With <a href="https://ollama.com">Ollama</a>, a free program, the AI runs on your computer. Nothing leaves your machine, local jobs cost nothing, and their receipts say “Free (ran on this computer)”.</p>
            <p>For bigger jobs, Magic Folder can use Claude with your own Anthropic API key.</p>
          </div>
        </section>

        <section className="section" id="your-name">
          <div className="wrap narrow">
            <p className="kicker">Your name on your receipts</p>
            <h2>Receipts that say they’re from you.</h2>
            <p className="lede">Start Magic Folder with your business name, and every receipt carries it.</p>
            <Code code={'magic-folder run ~/"Magic Folder" --engine ollama --issuer "Your Business"'} label="run with your business name" />
            <p style={{ marginTop: 24 }}>Then host your own verify page, so clients see <strong>Verified, signed by Your Business</strong>. One command makes it, with your public key built in:</p>
            <Code code={'magic-folder key\nmagic-folder verify-page verify.html --trust-key <your public key> --trust-name "Your Business" --title "Verify a Your Business receipt"'} label="make your verify page" />
            <p style={{ marginTop: 24 }}>Upload <code>verify.html</code> to your website. <a href={VERIFY}>verify.webaes.com</a> is a live example.</p>
          </div>
        </section>

        <section className="section" id="developers">
          <div className="wrap">
            <p className="kicker">For developers</p>
            <h2>The same receipts, for your own agents.</h2>
            <p className="lede">Magic Folder is built on Agent Receipts, an open-source toolkit for signed, checkable records of what an AI agent did.</p>
            <ul className="devs">
              <li><div><strong>MCP server</strong><span>Receipts for any MCP client, e.g. Claude Code</span></div><Code code="claude mcp add agent-receipts -- npx @agent-receipts/mcp-server" label="add the MCP server to Claude Code" /></li>
              <li><div><strong>SDK</strong><span>Receipts from your own code</span></div><Code code="npm install @agent-receipts/sdk" label="install the SDK" /></li>
              <li><div><strong>CLI</strong><span>Inspect and verify from a terminal</span></div><Code code="npx @agent-receipts/cli stats" label="run the CLI" /></li>
              <li><div><strong>Local dashboard</strong><span>A web view of your receipts</span></div><Code code="npx @agent-receipts/dashboard" label="start the dashboard" /></li>
              <li><div><strong>Live demo</strong><span>The dashboard with sample data</span></div><a href={DEMO}>demo.receipts.webaes.com</a></li>
              <li><div><strong>Source</strong><span>Code, docs and issues</span></div><a href={GITHUB}>github.com/webaesbyamin/agent-receipts</a></li>
              <li><div><strong>MCP Registry</strong><span>Listed as</span></div><a href="https://registry.modelcontextprotocol.io/v0/servers?search=io.github.webaesbyamin/agent-receipts"><code>io.github.webaesbyamin/agent-receipts</code></a></li>
            </ul>
          </div>
        </section>

        <section className="section faq" id="faq">
          <div className="wrap narrow">
            <p className="kicker">Questions</p>
            <h2>Good to know</h2>
            {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
