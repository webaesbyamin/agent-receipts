import type { Metadata } from 'next'
import product from '../../generated/product.json'
import { OSES, TROUBLE, UNINSTALL } from '../../../content/install.mjs'
import { Code } from '../../components/Code'
import { GITHUB } from '../../components/Chrome'

export const metadata: Metadata = {
  title: 'Install Magic Folder on Mac, Windows or Linux',
  description: 'Step-by-step: install Node 24, Ollama and Magic Folder, create your folder, and keep it running. Free and open source.',
  alternates: { canonical: '/install' },
}

const html = (s: string) => ({ __html: s })

type Step = { title: string; body?: string; code?: string; after?: string; code2?: string; check?: string; note?: string; list?: string[] }

export default function Install() {
  return (
    <main id="main" className="paper">
      <section className="hero install-hero" aria-labelledby="install-title">
        <div className="wrap grid">
          <p className="rcpt-head full"><span>RCPT_SITE_INSTALL</span><span className="lead" aria-hidden="true" /><span>{product.builtOn}</span></p>
          <h1 id="install-title" className="full">Set up Magic Folder.</h1>
          <p className="sub">You’ll install three free things: Node.js (which Magic Folder runs on), Ollama (the AI that runs on your computer) and Magic Folder itself. The longest part is the AI model download, about 5 GB.</p>
          <p className="mnote" style={{ '--row': 3 } as React.CSSProperties}>Used every day on a Mac. Every step on this page except installing Ollama and its model is also tested automatically on clean Mac, Windows and Linux machines whenever the code changes. Ollama is too large for those test machines, so jobs that use it are tested by hand on a Mac.</p>
        </div>
      </section>

      <section className="sec" aria-label="Install steps">
        <hr className="perf" />
        <div className="wrap guide">
          {/* Targets for /install#mac, #windows, #linux (the script opens that tab) */}
          {OSES.map((os) => <span key={os.id} id={os.id} />)}
          <div className="tabs" role="tablist" aria-label="Your computer" data-tabs="os">
            {OSES.map((os, i) => (
              <button key={os.id} type="button" role="tab" id={`tab-${os.id}`} data-tab={os.id} aria-controls={`panel-${os.id}`} aria-selected={i === 0} tabIndex={i === 0 ? 0 : -1}>{os.name}</button>
            ))}
          </div>

          {OSES.map((os) => (
            <div key={os.id} className="panel" role="tabpanel" id={`panel-${os.id}`} aria-labelledby={`tab-${os.id}`}>
              <p className="tip">Type the commands in {os.terminal}. Each black box has a Copy button.</p>
              <ol className="steps">
                {(os.steps as Step[]).map((s, n) => (
                  <li key={s.title}>
                    <p className="label">Step {String(n + 1).padStart(2, '0')}</p>
                    <h2 className="step-title">{s.title}</h2>
                    {s.body && <p dangerouslySetInnerHTML={html(s.body)} />}
                    {s.code && <Code code={s.code} label={`${os.name}: ${s.title}`} />}
                    {s.after && <p>{s.after}</p>}
                    {s.code2 && <Code code={s.code2} label={`${os.name}: ${s.title}, part 2`} />}
                    {s.list && <ul className="flags">{s.list.map((x) => <li key={x} dangerouslySetInnerHTML={html(x)} />)}</ul>}
                    {s.check && <p className="check" dangerouslySetInnerHTML={html(s.check)} />}
                    {s.note && <p className="tip" dangerouslySetInnerHTML={html(s.note)} />}
                  </li>
                ))}
              </ol>

              <div className="keep">
                <p className="label">After setup</p>
                <h2 id={`keep-${os.id}`}>Keep it running</h2>
                <p dangerouslySetInnerHTML={html(os.keep.intro)} />
                <Code code={os.keep.code} label={`${os.name}: keep it running`} />
                <p className="check" dangerouslySetInnerHTML={html(os.keep.check)} />
                <table className="controls">
                  <tbody>
                    {os.keep.controls.map(([label, cmd]) => (
                      <tr key={label}><th scope="row">{label}</th><td>{cmd.startsWith('Close ') ? cmd : <code>{cmd}</code>}</td></tr>
                    ))}
                  </tbody>
                </table>
                {'alt' in os.keep && os.keep.alt && (
                  <>
                    <p dangerouslySetInnerHTML={html(os.keep.alt.intro)} />
                    <Code code={os.keep.alt.code} label={`${os.name}: Desktop launcher`} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sec" aria-labelledby="trouble">
        <hr className="perf" />
        <div className="wrap guide">
          <p className="label">Help</p>
          <h2 id="trouble">If something goes wrong</h2>
          <div className="faq">
            {TROUBLE.map(([q, a]) => <details key={q}><summary>{q}</summary><p dangerouslySetInnerHTML={html(a)} /></details>)}
          </div>
          <p className="tip">Still stuck? Open an issue on <a href={`${GITHUB}/issues`}>GitHub</a> with what you typed and what it printed.</p>
        </div>
      </section>

      <section className="sec" aria-labelledby="uninstall">
        <hr className="perf" />
        <div className="wrap guide">
          <p className="label">Remove</p>
          <h2 id="uninstall">Uninstall</h2>
          <Code code={UNINSTALL.code} label="uninstall Magic Folder" />
          <p dangerouslySetInnerHTML={html(UNINSTALL.body)} />
        </div>
      </section>

      <section className="sec" aria-labelledby="claude">
        <hr className="perf" />
        <div className="wrap guide">
          <p className="label">Optional</p>
          <h2 id="claude">Use Claude</h2>
          <p>For bigger jobs, Magic Folder can use Claude with your own Anthropic API key. See <a href={`${GITHUB}/tree/main/packages/magic-folder#use-claude-optional`}>Use Claude</a> in the guide on GitHub. API keys only: Anthropic doesn’t allow other products to use claude.ai logins.</p>
        </div>
      </section>
    </main>
  )
}
