import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Header, Footer } from '../components/Chrome'
import { SITE_JS } from '../lib/scripts'

// The Webaes type system, self-hosted from src/fonts (no request to Google,
// at build time or in the browser).
const display = localFont({
  src: [{ path: '../fonts/archivo-latin-800-normal.woff2', weight: '800' }, { path: '../fonts/archivo-latin-900-normal.woff2', weight: '900' }],
  variable: '--f-display', display: 'swap', fallback: ['Arial Black', 'Impact', 'sans-serif'],
})
const sans = localFont({
  src: [{ path: '../fonts/dm-sans-latin-400-normal.woff2', weight: '400' }, { path: '../fonts/dm-sans-latin-500-normal.woff2', weight: '500' }],
  variable: '--f-sans', display: 'swap', fallback: ['-apple-system', 'Segoe UI', 'Helvetica', 'Arial', 'sans-serif'],
})
const mono = localFont({
  src: [{ path: '../fonts/dm-mono-latin-400-normal.woff2', weight: '400' }, { path: '../fonts/dm-mono-latin-500-normal.woff2', weight: '500' }],
  variable: '--f-mono', display: 'swap', fallback: ['ui-monospace', 'Menlo', 'Consolas', 'monospace'],
})

const TITLE = 'Agent Receipts by Webaes: signed receipts for what your AI agent did'
const DESCRIPTION = 'Every job your AI agent does can come back with a signed receipt: what went in, what came out, what it cost. Anyone can check it in a browser, offline. This page is signed too: edit any word and watch the stamp turn to VOID. Free and open source.'

export const metadata: Metadata = {
  metadataBase: new URL('https://receipts.webaes.com'),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website', url: 'https://receipts.webaes.com', siteName: 'Agent Receipts by Webaes',
    title: TITLE, description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'A receipt-style page headed “Your agent says it’s done. Prove it.”' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og.png'] },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'only light',
  themeColor: '#0a0a0a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <Header />
        {children}
        <Footer />
        <script dangerouslySetInnerHTML={{ __html: SITE_JS }} />
      </body>
    </html>
  )
}
