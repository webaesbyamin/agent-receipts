export const GITHUB = 'https://github.com/webaesbyamin/agent-receipts'
export const VERIFY = 'https://verify.webaes.com'
export const DEMO = 'https://demo.receipts.webaes.com'

/** The dark band at the top, ending in the torn edge where the paper starts. */
export function Header() {
  return (
    <>
      <header className="band">
        <div className="wrap band-in">
          <a className="mark" href="/"><b>Agent Receipts</b> <span>by Webaes</span></a>
          <nav aria-label="Main">
            <a href="/install" data-install-link>install</a>
            <a href="/#magic-folder">magic folder</a>
            <a href="/#stub">for your clients</a>
            <a href={GITHUB}>github <span aria-hidden="true">↗</span></a>
          </nav>
        </div>
      </header>
      <div className="torn torn-top" aria-hidden="true" />
    </>
  )
}

export function Footer() {
  return (
    <>
      <div className="torn torn-bottom" aria-hidden="true" />
      <footer className="band foot">
        <div className="wrap">
          <p className="mark"><b>Agent Receipts</b> <span>by Webaes</span></p>
          <nav aria-label="Footer">
            <a href={DEMO}>live demo</a>
            <a href={VERIFY}>verify a receipt</a>
            <a href="/install" data-install-link>install</a>
            <a href={GITHUB}>github</a>
            <a href="https://webaes.com">webaes.com</a>
            <a href={`${GITHUB}/blob/main/LICENSE`}>open source (MIT)</a>
          </nav>
        </div>
      </footer>
    </>
  )
}
