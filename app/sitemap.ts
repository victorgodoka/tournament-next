import type { MetadataRoute } from 'next'
import { listArticles } from '@utils/articles'
import { SITE_URL } from '@utils/config'

/** Regenerated hourly; a new article reaches search within the hour without a deploy. */
export const revalidate = 3600

/**
 * Every published article. The wiki index only links the first page ("load more" is client-side),
 * so without this the rest are orphans to a crawler. No cookie: the API returns published ones only.
 */
const articles = async (): Promise<MetadataRoute.Sitemap> => {
  const entries: MetadataRoute.Sitemap = []
  let cursor: string | undefined
  // ponytail: 100 pages × 50 = 5k articles; split into a sitemap index past that.
  for (let page = 0; page < 100; page++) {
    const { articles, nextCursor } = await listArticles({ limit: 50, cursor, sort: 'updated', order: 'desc' })
    for (const article of articles) {
      entries.push({ url: `${SITE_URL}/wiki/${article.slug}`, lastModified: article.updatedAt, changeFrequency: 'weekly' })
    }
    if (!nextCursor) break
    cursor = nextCursor
  }
  return entries
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const wiki = await articles().catch((error) => {
    console.error(error)
    return []
  })

  return [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/wiki`, lastModified: wiki[0]?.lastModified, changeFrequency: 'daily', priority: 0.8 },
    ...wiki,
  ]
}
