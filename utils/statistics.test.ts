import { describe, expect, it } from 'vitest'
import { deckHref, growthDays, matchupStatus } from './statistics'

const ci = (lower: number, upper: number) => ({ lower, upper, margin: (upper - lower) / 2 })

describe('matchupStatus', () => {
  it('calls a matchup only when the whole interval is on one side of 50%', () => {
    expect(matchupStatus(ci(0.51, 0.55))).toBe('favorable')
    expect(matchupStatus(ci(0.46, 0.49))).toBe('unfavorable')
    expect(matchupStatus(ci(0.49, 0.58))).toBe('neutral')
    expect(matchupStatus(undefined)).toBe('neutral')
  })
})

describe('growthDays', () => {
  it('is half the synced days, at most 7 and at least 1', () => {
    expect([1, 4, 11, 14, 40].map(growthDays)).toEqual([1, 2, 5, 7, 7])
  })
})

describe('deckHref', () => {
  it('keeps the season over the ladder and leaves the main mode out', () => {
    expect(deckHref([1, 2], { ladder: 'tcg' })).toBe('/statistics/archetypes/1-2?ladder=tcg')
    expect(deckHref([1], { ladder: 'tcg', season: 'tcg-2' }, 'general')).toBe('/statistics/archetypes/1?season=tcg-2&mode=general')
  })
})
