import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { LayoutShell } from '@/components/layout/layout-shell'
import { InteractiveProvider } from '@/lib/interactive-context'
import { demoMetadata } from '@/lib/demo-seo'

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// Fonts are downloaded once at build time and served from this app, so the
// local dashboard never calls Google (or anyone) when it opens.
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-sans', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' })

// The hosted demo adds its own titles, sharing tags and icons (demoMetadata);
// the local dashboard gets {} there and keeps these
export const metadata: Metadata = {
  title: 'Agent Receipts — Mission Control',
  description: 'Verifiable, signed, immutable proof that an autonomous action happened.',
  icons: { icon: { url: '/icon.svg', type: 'image/svg+xml' } },
  ...demoMetadata,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = <LayoutShell>{children}</LayoutShell>

  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme')
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                }
              } catch {}
            `,
          }}
        />
      </head>
      <body>
        {isDemoMode ? (
          <InteractiveProvider>{content}</InteractiveProvider>
        ) : (
          content
        )}
        {/* Page views for the hosted demo only. This app is also the npm dashboard people run
            on their own machines (build:standalone sets NEXT_PUBLIC_DEMO_MODE=false), where
            analytics must never load; build-standalone.js fails if it finds any. */}
        {isDemoMode && <Analytics />}
      </body>
    </html>
  )
}
