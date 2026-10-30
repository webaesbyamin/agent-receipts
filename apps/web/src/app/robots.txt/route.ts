import { DEMO_ROBOTS_TXT } from '@/lib/demo-seo'

export const dynamic = 'force-static'

// Only the hosted demo has a robots.txt; the local dashboard answers 404 as before
export function GET() {
  if (!DEMO_ROBOTS_TXT) return new Response('Not found', { status: 404 })
  return new Response(DEMO_ROBOTS_TXT, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
