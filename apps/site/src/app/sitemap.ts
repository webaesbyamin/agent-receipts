import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://receipts.webaes.com/', changeFrequency: 'monthly', priority: 1 },
    { url: 'https://receipts.webaes.com/install', changeFrequency: 'monthly', priority: 0.9 },
  ]
}
