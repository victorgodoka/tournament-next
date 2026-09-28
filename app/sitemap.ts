import type { MetadataRoute } from 'next'
import { SITE_URL } from '@utils/config'

/**
 * The site's own pages. Wiki articles have their own sitemap at /wiki/sitemap.xml (declared in robots.ts),
 * built by the API: it alone knows which articles are noindex or canonicalised elsewhere.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL, changeFrequency: 'daily', priority: 1 }]
}
