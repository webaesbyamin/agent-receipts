import type { Metadata, Viewport } from 'next'
import { Archivo, DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import { Header, Footer } from '../components/Chrome'
import { SITE_JS } from '../lib/scripts'

// The Webaes type system. next/font downloads these at build time and serves
// them from this site; no request goes to Google.
const display = Archivo({ subsets: ['latin'], weight: ['800', '900'], variable: '--f-display', display: 'swap' })
const sans = DM_Sans({ subsets: ['latin'], weight: ['400', '500'], variable: '--f-sans', display: 'swap' })
const mono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--f-mono', display: 'swap' })

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
