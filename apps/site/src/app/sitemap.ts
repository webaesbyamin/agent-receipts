import type { MetadataRoute } from 'next'
import product from '../generated/product.json'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://receipts.webaes.com/', lastModified: product.builtOn, changeFrequency: 'monthly', priority: 1 },
    { url: 'https://receipts.webaes.com/install', lastModified: product.builtOn, changeFrequency: 'monthly', priority: 0.9 },
  ]
}
