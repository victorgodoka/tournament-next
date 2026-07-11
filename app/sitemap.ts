import type { MetadataRoute } from 'next'
import { getLeaderboard } from './leaderboards/leaderboards.api'
import { INDEXABLE_ROUTES } from '@lib/seo-routes'
import { SITE_URL } from '@lib/site-config'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = INDEXABLE_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path === '/' ? '' : route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  const leaderboardResult = await getLeaderboard()
  if (!leaderboardResult.ok) {
    return staticEntries
  }

  const profileIds = new Set<string>()
  for (const player of leaderboardResult.data.TCG) {
    profileIds.add(player.id)
  }

  const profileEntries: MetadataRoute.Sitemap = [...profileIds].map((id) => ({
    url: `${SITE_URL}/profile/${id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [...staticEntries, ...profileEntries]
}
