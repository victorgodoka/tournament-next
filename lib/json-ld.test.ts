import { describe, expect, it } from 'vitest'
import {
  leaderboardJsonLd,
  profileJsonLd,
  siteJsonLd,
} from './json-ld'

describe('json-ld', () => {
  it('builds site JSON-LD with graph entries', () => {
    const jsonLd = siteJsonLd()

    expect(jsonLd['@context']).toBe('https://schema.org')
    expect(jsonLd['@graph']).toHaveLength(2)
    expect(jsonLd['@graph'][0]!['@type']).toBe('WebApplication')
    expect(jsonLd['@graph'][1]!['@type']).toBe('Organization')
  })

  it('builds leaderboard JSON-LD with list items', () => {
    const jsonLd = leaderboardJsonLd([
      { id: 'player-1', displayname: 'Champion', rating: 2100 },
      { id: 'player-2', displayname: 'Runner', rating: 1800 },
    ])

    expect(jsonLd['@type']).toBe('ItemList')
    expect(jsonLd.itemListElement).toHaveLength(2)
    expect(jsonLd.itemListElement[0]).toMatchObject({
      '@type': 'ListItem',
      position: 1,
      name: 'Champion',
      url: expect.stringContaining('/profile/player-1'),
    })
  })

  it('builds profile JSON-LD with optional avatar', () => {
    const jsonLd = profileJsonLd({
      id: 'player-1',
      displayname: 'Champion',
      avatarUrl: 'https://example.com/avatar.png',
      tcgRating: 2100,
      tcgWins: 50,
      tcgLosses: 10,
    })

    expect(jsonLd['@type']).toBe('ProfilePage')
    expect(jsonLd.mainEntity).toMatchObject({
      '@type': 'Person',
      name: 'Champion',
      image: 'https://example.com/avatar.png',
    })
  })
})
