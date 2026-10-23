import { describe, expect, it } from 'vitest'
import type { TimelineRow } from '@utils/statistics'
import { byDeck, byPair, eloChange, inPeriod, insights, matchTally, MIN_MATCHES, previousPeriod, streaks } from './insights'

const NOW = Date.parse('2026-10-22T12:00:00Z')
const at = (daysAgo: number) => new Date(NOW - daysAgo * 86_400_000).toISOString()
const row = (daysAgo: number | null, result: TimelineRow[1], deck: string | null = '1', opp: string | null = '2'): TimelineRow =>
  [daysAgo === null ? null : at(daysAgo), result, deck, opp, result === 'W' ? 2 : 1, result === 'L' ? 2 : 1, 0]

describe('player insights', () => {
  it('cuts periods and the one before', () => {
    const rows = [row(1, 'W'), row(5, 'L'), row(10, 'W'), row(40, 'D'), row(null, 'W')]
    expect(inPeriod(rows, 7, NOW)).toHaveLength(2)
    expect(inPeriod(rows, null, NOW)).toHaveLength(5)
    expect(previousPeriod(rows, 7, NOW)).toHaveLength(1)
    expect(previousPeriod(rows, null, NOW)).toBeNull()
    expect(matchTally(rows)).toEqual({ wins: 3, losses: 1, draws: 1 })
  })

  it('reads streaks newest first, skipping matches without a result', () => {
    expect(streaks([row(1, 'W'), row(2, null), row(3, 'W'), row(4, 'L'), row(5, 'W'), row(6, 'W'), row(7, 'W')])).toEqual({
      current: { result: 'W', count: 2 },
      bestWins: 3,
    })
    expect(streaks([])).toEqual({ current: null, bestWins: 0 })
  })

  it('splits by deck and by pair, unknown decks out', () => {
    const rows = [row(1, 'W', '1', '2'), row(2, 'L', '1', '3'), row(3, 'W', '4', '2'), row(4, 'W', null, '2')]
    expect(byDeck(rows).map((d) => [d.key, d.matches.wins])).toEqual([['1', 1], ['4', 1]])
    expect(byPair(rows).map((d) => d.key)).toEqual(['1|2', '1|3', '4|2'])
  })

  it('takes the Elo change from the first point of the period', () => {
    const history = [{ day: '2026-10-01', seasonDay: 1, elo: 1500 }, { day: '2026-10-18', seasonDay: 18, elo: 1600 }]
    expect(eloChange(history, 1650, 7, NOW)).toBe(50)
    expect(eloChange(history, 1650, null, NOW)).toBe(150)
    expect(eloChange([], 1650, 7, NOW)).toBeNull()
  })

  it('only calls a deck or matchup better with enough matches, and says so when it is not', () => {
    const many = (n: number, result: TimelineRow[1], deck: string, opp = '9') => Array.from({ length: n }, (_, i) => row(1 + i / 100, result, deck, opp))
    const names = (k: string) => `deck ${k}`
    const strong = [...many(8, 'W', '1'), ...many(2, 'L', '1'), ...many(4, 'W', '2', '8'), ...many(6, 'L', '2', '8')]
    const ids = insights({ rows: strong, previous: null, elo: null, names }).map((i) => i.id)
    expect(ids).toContain('deckCompare')
    expect(ids).toContain('weakMatchup')
    const few = insights({ rows: many(MIN_MATCHES - 1, 'W', '1'), previous: null, elo: 12, names })
    expect(few.map((i) => i.id)).toEqual(['eloUp', 'smallSample'])
    expect(few[1]!.values).toMatchObject({ n: MIN_MATCHES - 1 })
  })
})
