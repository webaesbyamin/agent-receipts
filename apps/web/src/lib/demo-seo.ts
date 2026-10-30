// Search and sharing metadata for the hosted demo (demo.receipts.webaes.com).
// Only demo builds use this file: every other build, including the npm
// dashboard, resolves '@/lib/demo-seo' to ./no-demo-seo.ts (see next.config.ts).
import type { Metadata } from 'next'

const SITE = 'https://receipts.webaes.com'
const DEMO = 'https://demo.receipts.webaes.com'
const TITLE = 'Live Demo | Agent Receipts Dashboard | Webaes'
const DESCRIPTION = 'Explore the Agent Receipts dashboard with sample data: signed receipts, chains, agents and memory. Run your own locally with npx @agent-receipts/dashboard.'
const IMAGE = { url: `${SITE}/og.png`, width: 1200, height: 630, alt: 'Your agent says it’s done. Prove it.' }

function page(title: string, description: string, path: string): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', url: path, siteName: 'Agent Receipts by Webaes', locale: 'en_US', title, description, images: [IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [IMAGE.url] },
  }
}

export const demoMetadata: Metadata = {
  metadataBase: new URL(DEMO),
  ...page(TITLE, DESCRIPTION, './'),
  icons: {
    icon: [{ url: `${SITE}/icon.svg`, type: 'image/svg+xml' }, { url: `${SITE}/favicon.ico`, sizes: '16x16 32x32 48x48' }],
    apple: `${SITE}/apple-icon.png`,
  },
}

export const walkthroughMetadata: Metadata = page(
  'Interactive Demo | Agent Receipts | Webaes',
  'Experience how AI agents store verifiable, cryptographically signed memories in 60 seconds.',
  '/walkthrough',
)

export const howItWorksMetadata: Metadata = page(
  'How It Works | Agent Receipts Memory | Webaes',
  'How an AI agent’s memory becomes something you can check: each thing it learns is stored as a signed receipt you can verify and take with you.',
  '/how-it-works',
)

// The only pages worth indexing; sample-data pages answer with X-Robots-Tag: noindex, follow (vercel.json)
const INDEXED = ['/', '/walkthrough', '/how-it-works']

export const DEMO_ROBOTS_TXT: string | null = `User-agent: *\nAllow: /\n\nSitemap: ${DEMO}/sitemap.xml\n`

export const DEMO_SITEMAP_XML: string | null = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${INDEXED.map((p) => `  <url><loc>${DEMO}${p}</loc><changefreq>monthly</changefreq></url>`).join('\n')}
</urlset>
`
