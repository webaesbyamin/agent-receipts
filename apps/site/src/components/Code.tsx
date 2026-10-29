/** A command with a Copy button. The button copies the text exactly as shown. */
export function Code({ code, label }: { code: string; label?: string }) {
  return (
    <div className="code">
      <pre tabIndex={0}><code>{code}</code></pre>
      <button className="copy" type="button" data-copy aria-label={label ? `Copy: ${label}` : 'Copy command'}>Copy</button>
    </div>
  )
}
