import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../../messages/en.json'
import type { PlayerTournamentStats } from '@utils/types'
import { TournamentReport } from './TournamentReport'

const text = (data: PlayerTournamentStats) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <TournamentReport data={data} />
    </NextIntlClientProvider>,
  ).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

/** Won 2:0 and 2:1, lost 1:2: 2–1 in matches, 5–3 in games. */
const stats = (games: boolean): PlayerTournamentStats => ({
  format: null,
  formats: [{ format: 'TCG', tournaments: 1 }],
  tournaments: 1,
  titles: 0,
  record: { wins: 2, loses: 1, draws: 0, ...(games && { games: { wins: 5, loses: 3, draws: 0 } }) },
  turnOrder: { first: { games: 2, wins: 1 }, second: { games: 1, wins: 1 } },
  matches: { total: 3, played: 3, unplayed: 0, draws: 0, games: 8, threeGameMatches: 2, onThePlay: { games: 3, wins: 2 } },
  archetypes: [{ archetype: 'Branded', players: 1, share: 1, artCardId: null, wins: 2, loses: 1, draws: 0, winRate: 0.6667, ...(games && { games: { wins: 5, loses: 3, draws: 0 } }) }],
  matchups: [{ archetype: 'Branded', opponent: 'Kashtira', wins: 2, loses: 1, draws: 0, ...(games && { games: { wins: 5, loses: 3, draws: 0 } }) }],
  cards: { main: [], extra: [] },
})

describe('TournamentReport', () => {
  it('shows match and game win rate', () => {
    const out = text(stats(true))
    expect(out).toContain('Match win rate 66.7%')
    expect(out).toContain('Game win rate 62.5% 8 games')
  })

  // The front deploys on a push, the API by hand: a page against an API older than `games` must still draw.
  it('reads an API without games as no game rate', () => {
    const out = text(stats(false))
    expect(out).toContain('Match win rate 66.7%')
    expect(out).toContain('Game win rate —')
  })
})
