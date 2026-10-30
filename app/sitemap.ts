import type { MetadataRoute } from 'next'
import { BANLIST_CARDS, BANLISTS, banlistPath, cardChanges, cardPath, currentBanlist } from '@utils/banlist'
import { SITE_URL } from '@utils/config'
import { LEGAL_UPDATED } from '@utils/const'

/**
 * The site's own pages. Wiki articles have their own sitemap at /wiki/sitemap.xml (declared in robots.ts),
 * built by the API: it alone knows which articles are noindex or canonicalised elsewhere.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/download`, changeFrequency: 'monthly', priority: 0.8 },
    // Where the old tournament.duelistsunite.org links now land.
    { url: `${SITE_URL}/leaderboard`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/tournaments`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/calendar`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/statistics`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/decks`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/deck-builder`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/simulator`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/banlist`, lastModified: currentBanlist().date, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/banlist-timeline`, lastModified: BANLISTS.at(-1)!.date, changeFrequency: 'weekly', priority: 0.8 },
    // The current list's dated page canonicalises to /banlist.
    ...BANLISTS.filter((list) => list.date !== currentBanlist().date).map((list) => ({
      url: `${SITE_URL}${banlistPath(list)}`,
      lastModified: list.end ?? list.date,
      changeFrequency: list.end ? ('yearly' as const) : ('weekly' as const),
      priority: list.end ? 0.5 : 0.7,
    })),
    ...BANLIST_CARDS.map((_, card) => ({
      url: `${SITE_URL}${cardPath(card)}`,
      lastModified: cardChanges(card).at(-1)!.list.date,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    { url: `${SITE_URL}/privacy`, lastModified: LEGAL_UPDATED.privacy, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: LEGAL_UPDATED.terms, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
