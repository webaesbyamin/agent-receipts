import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderVerifyPage, type VerifyPageTheme } from '../verify-page.js'
import { RECEIPT_CSS } from '../browser-render.js'

const publicKey = 'b293d3f52ad15d278870eb07b63edbe82b697ad52c8a9232f1136ad2c7e623b6'
const webaes: VerifyPageTheme = {
  heading: 'Verify a Webaes receipt',
  brandName: 'Webaes', brandSub: 'verify.webaes.com', homeUrl: 'https://www.webaes.com',
  ink: '#0b0b0b', paper: '#f3f1ec', accent: '#ef5451',
  fontDisplay: 'Archivo, "Arial Black", sans-serif', fontBody: '"DM Sans", Helvetica, sans-serif', fontMono: '"DM Mono", ui-monospace, monospace',
  fontCss: '@font-face{font-family:Archivo;font-weight:900;src:url(/fonts/archivo-latin-900-normal.woff2) format("woff2")}',
  icon: '/icon.svg', appleIcon: '/apple-icon.png', themeColor: '#0a0a0a',
  description: 'Drop a receipt from Webaes to check its signature in your browser.',
  ogImage: 'https://verify.webaes.com/og.png', canonical: 'https://verify.webaes.com/',
  links: [{ label: 'receipts.webaes.com', url: 'https://receipts.webaes.com' }, { label: 'public key', url: '/.well-known/agent-receipts.json' }],
}

describe('verify page theming', () => {
  it('no theme (or an empty one) is the neutral page, byte for byte', () => {
    const neutral = renderVerifyPage()
    expect(renderVerifyPage({ theme: {} })).toBe(neutral)
    expect(renderVerifyPage({ theme: { brandName: undefined, accent: undefined, links: undefined } })).toBe(neutral)
    expect(readFileSync(join(__dirname, '..', '..', '..', '..', 'apps', 'verify', 'index.html'), 'utf-8')).toBe(neutral)
    const branded = renderVerifyPage({ trustedKeys: [{ name: 'Webaes', publicKey }] })
    expect(renderVerifyPage({ trustedKeys: [{ name: 'Webaes', publicKey }], theme: {} })).toBe(branded)
  })

  it('applies every value', () => {
    const page = renderVerifyPage({ title: 'Verify a Webaes Receipt | Ed25519 in Your Browser | Webaes', trustedKeys: [{ name: 'Webaes', publicKey }], theme: webaes })
    expect(page).toContain('<header class="band"><a class="mark" href="https://www.webaes.com"><b>Webaes</b> <span>verify.webaes.com</span></a></header>')
    expect(page).toContain('<title>Verify a Webaes Receipt | Ed25519 in Your Browser | Webaes</title>')
    expect(page).toContain('<h1 class="page-title">Verify a Webaes receipt</h1>')
    expect(page).toContain(':root{--ink:#0b0b0b;--paper:#f3f1ec;--accent:#ef5451;--fd:Archivo, "Arial Black", sans-serif;')
    expect(page).toContain('@font-face{font-family:Archivo;font-weight:900;src:url(/fonts/archivo-latin-900-normal.woff2) format("woff2")}')
    expect(page).toContain('<meta name="description" content="Drop a receipt from Webaes to check its signature in your browser.">')
    expect(page).toContain('<link rel="canonical" href="https://verify.webaes.com/">')
    expect(page).toContain('<meta name="theme-color" content="#0a0a0a">')
    expect(page).toContain('<link rel="icon" href="/icon.svg" type="image/svg+xml">')
    expect(page).toContain('<link rel="apple-touch-icon" href="/apple-icon.png">')
    expect(page).toContain('<meta property="og:title" content="Verify a Webaes Receipt | Ed25519 in Your Browser | Webaes">')
    expect(page).toContain('<meta property="og:image" content="https://verify.webaes.com/og.png">')
    expect(page).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(page).toContain('<footer class="site-foot"><nav aria-label="Links"><a href="https://receipts.webaes.com">receipts.webaes.com</a><a href="/.well-known/agent-receipts.json">public key</a></nav></footer>')
    // The check itself is the same code as the neutral page
    expect(page).toContain('id="trusted-keys"')
  })

  it('links a stylesheet URL instead of inlining it', () => {
    expect(renderVerifyPage({ theme: { fontCss: 'https://example.com/fonts.css' } })).toContain('<link rel="stylesheet" href="https://example.com/fonts.css">')
  })

  it('escapes text and rejects anything that could inject markup, script or CSS', () => {
    const page = renderVerifyPage({
      title: 'A "quoted" <title>',
      theme: { heading: '<b onclick=x>h</b>', brandName: '<script>alert(1)</script>', brandSub: '"x" & y', description: '"><script>alert(1)</script>', links: [{ label: '<img src=x onerror=alert(1)>', url: '/ok' }] },
    })
    expect(page).not.toMatch(/<script>alert|<img src=x|<b onclick/)
    expect(page).toContain('<b>&lt;script&gt;alert(1)&lt;/script&gt;</b> <span>&quot;x&quot; &amp; y</span>')
    expect(page).toContain('content="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"')
    expect(page).toContain('content="A &quot;quoted&quot; &lt;title&gt;"')
    const bad: Array<[VerifyPageTheme, string]> = [
      [{ accent: 'red;}body{display:none' }, 'accent must be a hex colour'],
      [{ ink: 'url(x)' }, 'ink must be a hex colour'],
      [{ paper: '#fff;' }, 'paper must be a hex colour'],
      [{ themeColor: 'javascript:1' }, 'theme-color must be a hex colour'],
      [{ homeUrl: 'javascript:alert(1)', brandName: 'x' }, 'home-url must be an http(s) URL'],
      [{ canonical: 'https://x.com/" onload="x' }, 'canonical must be'],
      [{ ogImage: 'data:image/png;base64,AAA' }, 'og-image must be'],
      [{ icon: '//evil.example/icon.svg' }, 'icon must be'],
      [{ links: [{ label: 'x', url: 'javascript:alert(1)' }] }, 'link must be'],
      [{ fontDisplay: 'Archivo;}body{display:none' }, 'font-display may only contain'],
      [{ fontMono: 'x</style><script>' }, 'font-mono may only contain'],
      [{ fontCss: '</style><script>alert(1)</script>' }, 'font-css must be'],
    ]
    for (const [theme, message] of bad) expect(() => renderVerifyPage({ theme }), JSON.stringify(theme)).toThrow(message)
  })

  it('keeps every result state readable: text at 4.5:1 or better in the Webaes theme', () => {
    const page = renderVerifyPage({ trustedKeys: [{ name: 'Webaes', publicKey }], theme: webaes })
    const vars = Object.fromEntries([...RECEIPT_CSS.matchAll(/--([a-z-]+):(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]))
    const lum = (hex: string) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
    const pairs: Array<[string, string, string]> = [
      ['verified (green)', vars.good, vars['good-bg']],
      ['unchanged, signer not confirmed (amber)', vars.wait, vars['wait-bg']],
      ['not verified (red)', vars.bad, vars['bad-bg']],
      ['page text', webaes.ink!, webaes.paper!],
      ['muted text on the receipt', vars.muted, vars.card],
      ['drop zone', webaes.ink!, '#ffffff'],
    ]
    for (const [what, fg, bg] of pairs) expect(ratio(fg, bg), `${what}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    // The accent (Webaes red, 3.4:1 on paper) is only used for edges and focus rings, never for text
    expect(page).not.toMatch(/[{;]color:var\(--accent\)/)
    expect(ratio(webaes.accent!, webaes.paper!)).toBeGreaterThanOrEqual(3)
  })
})
