import type { MetadataRoute } from 'next'
import { SITE_URL } from '@utils/config'

/** Editor-only wiki routes and the simulator's preview are also `noindex`; blocking them just saves crawl budget. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/wiki/new', '/wiki/panel', '/wiki/example', '/simulator/new'] },
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/wiki/sitemap.xml`],
  }
}
