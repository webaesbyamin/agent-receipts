import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

// /api/waitlist is POST-only. Googlebot finds it in the JS, GETs it, gets a 405,
// and Search Console reports "Blocked due to other 4xx issue". Keep crawlers out.

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: '/api/' }], sitemap: 'https://receipts.webaes.com/sitemap.xml' }
}
