// Stands in for ./demo-seo.ts in every build that isn't the hosted demo (see
// next.config.ts): the dashboard keeps its own titles, and has no robots.txt
// or sitemap.
import type { Metadata } from 'next'

export const demoMetadata: Metadata = {}

export const walkthroughMetadata: Metadata = {
  title: 'Interactive Demo — Agent Receipts',
  description: 'Experience how AI agents store verifiable, cryptographically signed memories in 60 seconds.',
}

export const howItWorksMetadata: Metadata = {}

export const DEMO_ROBOTS_TXT: string | null = null
export const DEMO_SITEMAP_XML: string | null = null
