import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../../messages/pt.json'
import type { PlayerStatisticsData, TimelineRow } from '@utils/statistics'
import { RankedDashboard } from './RankedDashboard'

vi.mock('next/dynamic', () => ({ default: () => () => null }))

const NOW = Date.now()
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString()
/** 12 matches with deck 1 (8-4) against 2 and 3, the newest a 3-win run. */
const timeline: TimelineRow[] = [
  [ago(1), 'W', '1', '2', 2, 0, 0],
  [ago(2), 'W', '1', '3', 2, 1, 0],
  [ago(3), 'W', '1', '2', 2, 1, 0],
  [ago(4), 'L', '1', '3', 1, 2, 0],
  ...Array.from({ length: 8 }, (_, i): TimelineRow => [ago(5 + i), i < 5 ? 'W' : 'L', '1', '2', i < 5 ? 2 : 0, i < 5 ? 0 : 2, 0]),
]
const tally = { wins: 8, losses: 4, draws: 0 }
const split = { first: { games: 10, winRate: 0.6 }, second: { games: 10, winRate: 0.5 } }
const data = {
  season: null,
  formats: ['TCG'],
  matches: { analyzed: 12, total: 12 },
  archetypes: [],
  turnOrder: { all: split, game1: split, postSide: split },
  record: { matches: tally, games: tally, decks: [], matchups: [], timeline, deckNames: { 1: 'Branded', 2: 'Snake-Eye', 3: 'Tenpai' } },
} as unknown as PlayerStatisticsData

const text = () =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="pt" messages={messages} timeZone="UTC">
      <RankedDashboard data={data} standing={{ elo: 1650, tier: 'Gold', rank: 12, eloHistory: [{ day: ago(24 * 20).slice(0, 10), seasonDay: 1, elo: 1500 }] }} matches={[]} profileId="1" />
    </NextIntlClientProvider>,
  ).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('RankedDashboard', () => {
  it('draws the KPIs, decks, matchups and analysis from the timeline', () => {
    const out = text()
    expect(out).toContain('8 / 12 partidas')
    expect(out).toContain('3 vitórias seguidas')
    expect(out).toContain('Melhor: 5 vitórias')
    expect(out).toContain('Branded')
    expect(out).toContain('Snake-Eye')
    // Elo 1500 -> 1650 in the 30 days: the change and the analysis line.
    expect(out).toContain('+150')
    expect(out).toContain('Seu Elo subiu 150 pontos neste período.')
    // A missing key renders its path: none may show.
    expect(out).not.toMatch(/PlayerStatistics\./)
  })

  it('offers 14 and 30 days only once the season is that long', () => {
    const render = (startsDaysAgo: number) =>
      renderToStaticMarkup(
        <NextIntlClientProvider locale="pt" messages={messages} timeZone="UTC">
          <RankedDashboard data={{ ...data, season: { startsAt: ago(startsDaysAgo * 24) } } as PlayerStatisticsData} standing={null} matches={[]} profileId="1" />
        </NextIntlClientProvider>,
      )
    const short = render(5)
    expect(short).toContain('Desde o início da temporada')
    expect(short).toContain('Últimos 7 dias')
    expect(short).not.toContain('Últimos 14 dias')
    expect(short).not.toContain('Últimos 30 dias')
    const long = render(40)
    expect(long).toContain('Últimos 14 dias')
    expect(long).toContain('Últimos 30 dias')
  })
})
