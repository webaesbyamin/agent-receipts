import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SITE_JS } from '../components/Chrome'

const TITLE = 'Magic Folder by Webaes: AI work with a receipt anyone can check'
const DESCRIPTION = 'Drop a file into a folder on your computer and get the work back with a signed receipt: what went in, what came out, what it cost. Change one word and the seal breaks. Free and open source, for Mac, Windows and Linux.'

export const metadata: Metadata = {
  metadataBase: new URL('https://receipts.webaes.com'),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website', url: 'https://receipts.webaes.com', siteName: 'Agent Receipts by Webaes',
    title: TITLE, description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'A file dropped into Fix typos comes back in Done with a receipt marked Verified, signed by Webaes.' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og.png'] },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor: '#f3efe6',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        {children}
        <script dangerouslySetInnerHTML={{ __html: SITE_JS }} />
      </body>
    </html>
  )
}
