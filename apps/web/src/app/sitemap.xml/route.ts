import { DEMO_SITEMAP_XML } from '@/lib/demo-seo'

export const dynamic = 'force-static'

// Only the hosted demo has a sitemap; the local dashboard answers 404 as before
export function GET() {
  if (!DEMO_SITEMAP_XML) return new Response('Not found', { status: 404 })
  return new Response(DEMO_SITEMAP_XML, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
