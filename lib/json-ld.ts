import { ORGANIZATION_SAME_AS, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from './site-config'

export function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: SITE_NAME,
        alternateName: 'Yu-Gi-Oh! Omega',
        url: SITE_URL,
        description:
          'Free Yu-Gi-Oh! simulator and competitive platform by Duelists Unite.',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Duelists Unite',
        },
      },
      {
        '@type': 'Organization',
        name: 'Duelists Unite',
        url: SITE_URL,
        logo: `${SITE_URL}/logo.png`,
        sameAs: [...ORGANIZATION_SAME_AS],
      },
    ],
  }
}

type LeaderboardEntry = {
  id: string
  displayname: string
  rating: number
}

export function leaderboardJsonLd(entries: LeaderboardEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'YGO Omega TCG Leaderboard',
    description: SITE_DESCRIPTION,
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.displayname,
      url: `${SITE_URL}/profile/${entry.id}`,
    })),
  }
}

export function profileJsonLd(player: {
  id: string
  displayname: string
  avatarUrl?: string
  tcgRating: number
  tcgWins: number
  tcgLosses: number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: `${player.displayname} — YGO Omega Profile`,
    url: `${SITE_URL}/profile/${player.id}`,
    mainEntity: {
      '@type': 'Person',
      name: player.displayname,
      identifier: player.id,
      ...(player.avatarUrl ? { image: player.avatarUrl } : {}),
      description: `TCG rating ${Math.round(player.tcgRating)} · ${player.tcgWins}W-${player.tcgLosses}L on YGO Omega.`,
    },
  }
}
