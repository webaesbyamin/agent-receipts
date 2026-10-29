import type { Metadata } from 'next'
import { OSES, TROUBLE, UNINSTALL } from '../../../content/install.mjs'
import { Code } from '../../components/Code'
import { Nav, Footer, GITHUB } from '../../components/Chrome'

export const metadata: Metadata = {
  title: 'Install Magic Folder on Mac, Windows or Linux',
  description: 'Step-by-step: install Node 24, Ollama and Magic Folder, create your folder, and keep it running. Free and open source.',
  alternates: { canonical: '/install' },
}

const html = (s: string) => ({ __html: s })

type Step = { title: string; body?: string; code?: string; after?: string; code2?: string; check?: string; note?: string; list?: string[] }

export default function Install() {
  return (
    <>
      <Nav home={false} />
      <main id="main">
        <section className="hero" style={{ paddingBottom: 40 }}>
          <div className="wrap narrow">
            <p className="kicker">Install</p>
            <h1>Set up Magic Folder in about 15 minutes.</h1>
            <p className="lede">You’ll install three free things: Node.js (which Magic Folder runs on), Ollama (the AI that runs on your computer) and Magic Folder itself. Most of the time is the AI model downloading.</p>
            <p className="small">Used every day on a Mac. On Mac, Windows and Linux, every command on this page is also run automatically on a clean machine whenever the code changes. The one exception is Ollama itself, which is too large for those test machines.</p>
          </div>
        </section>

        <section className="wrap narrow" style={{ paddingBottom: 72 }}>
          <div className="tabs" role="tablist" aria-label="Your computer">
            {OSES.map((os, i) => (
              <button key={os.id} type="button" role="tab" id={`tab-${os.id}`} data-os={os.id} aria-controls={`panel-${os.id}`} aria-selected={i === 0} tabIndex={i === 0 ? 0 : -1}>{os.name}</button>
            ))}
          </div>

          {OSES.map((os) => (
            <div key={os.id} className="panel" role="tabpanel" id={`panel-${os.id}`} aria-labelledby={`tab-${os.id}`}>
              <p className="tip">Type the commands in {os.terminal}. Each grey box has a Copy button.</p>
              <ol className="steps">
                {(os.steps as Step[]).map((s) => (
                  <li key={s.title}>
                    <h3>{s.title}</h3>
                    {s.body && <p dangerouslySetInnerHTML={html(s.body)} />}
                    {s.code && <Code code={s.code} label={`${os.name}: ${s.title}`} />}
                    {s.after && <p style={{ marginTop: 12 }}>{s.after}</p>}
                    {s.code2 && <Code code={s.code2} label={`${os.name}: ${s.title}, part 2`} />}
                    {s.list && <ul className="flags">{s.list.map((x) => <li key={x} dangerouslySetInnerHTML={html(x)} />)}</ul>}
                    {s.check && <p className="check" dangerouslySetInnerHTML={html(s.check)} />}
                    {s.note && <p className="tip" dangerouslySetInnerHTML={html(s.note)} />}
                  </li>
                ))}
              </ol>

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
                  <p style={{ marginTop: 28 }} dangerouslySetInnerHTML={html(os.keep.alt.intro)} />
                  <Code code={os.keep.alt.code} label={`${os.name}: Desktop launcher`} />
                </>
              )}
            </div>
          ))}

          <h2 style={{ marginTop: 64 }} id="trouble">If something goes wrong</h2>
          <div className="faq">
            {TROUBLE.map(([q, a]) => <details key={q}><summary>{q}</summary><p dangerouslySetInnerHTML={html(a)} /></details>)}
          </div>
          <p className="tip" style={{ marginTop: 18 }}>Still stuck? Open an issue on <a href={`${GITHUB}/issues`}>GitHub</a> with what you typed and what it printed.</p>

          <h2 style={{ marginTop: 64 }} id="uninstall">Uninstall</h2>
          <Code code={UNINSTALL.code} label="uninstall Magic Folder" />
          <p style={{ marginTop: 12 }} dangerouslySetInnerHTML={html(UNINSTALL.body)} />

          <h2 style={{ marginTop: 64 }} id="claude">Use Claude (optional)</h2>
          <p>For bigger jobs, Magic Folder can use Claude with your own Anthropic API key. See <a href={`${GITHUB}/tree/main/packages/magic-folder#use-claude-optional`}>Use Claude</a> in the guide on GitHub. API keys only: Anthropic doesn’t allow other products to use claude.ai logins.</p>
        </section>
      </main>
      <Footer />
    </>
  )
}
