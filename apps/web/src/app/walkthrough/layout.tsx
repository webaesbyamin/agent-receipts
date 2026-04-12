import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Interactive Demo — Agent Receipts',
  description: 'Experience how AI agents store verifiable, cryptographically signed memories in 60 seconds.',
}

export default function WalkthroughLayout({ children }: { children: React.ReactNode }) {
  return children
}
