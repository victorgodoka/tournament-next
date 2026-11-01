
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@utils/config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/wiki/new',
          '/wiki/panel',
          '/simulator/new',
        ],
      },
      {
        userAgent: 'Amazonbot',
        disallow: '/',
      },
    ],
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/wiki/sitemap.xml`,
    ],
  }
}
