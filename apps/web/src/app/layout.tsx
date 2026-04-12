import type { Metadata } from 'next'
import './globals.css'
import { LayoutShell } from '@/components/layout/layout-shell'
import { InteractiveProvider } from '@/lib/interactive-context'

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export const metadata: Metadata = {
  title: 'Agent Receipts — Mission Control',
  description: 'Verifiable, signed, immutable proof that an autonomous action happened.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const content = <LayoutShell>{children}</LayoutShell>

  return (
    <html lang="en" suppressHydrationWarning>
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
      </body>
    </html>
  )
}
