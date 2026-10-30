/**
 * A command with a Copy button. The button copies the text exactly as shown.
 * The command is part of the home page's signature (data-signed).
 */
export function Code({ code, label, pill = false }: { code: string; label?: string; pill?: boolean }) {
  return (
    <div className={pill ? 'code pill' : 'code'}>
      {!pill && <div className="code-bar"><button className="copy" type="button" data-copy aria-label={label ? `Copy: ${label}` : 'Copy command'}>Copy</button></div>}
      <pre tabIndex={0} aria-label={label}><code data-signed>{code}</code></pre>
      {pill && <button className="copy" type="button" data-copy aria-label={label ? `Copy: ${label}` : 'Copy command'}>Copy</button>}
    </div>
  )
}
