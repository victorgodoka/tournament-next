import { describe, expect, it } from 'vitest'
import { deckFaces, families, type DeckStat, type Meta, type Week } from '@utils/statistics'
import { fallers, leaders, listed, name, risers, tier, type Ladder } from './tier-list'

const deck = (key: string, wrExpected: number, deckTier: DeckStat['tier'], share = 0.1, players = 50) =>
  ({ key, name: `Deck ${key}`, wrExpected, wrLo: wrExpected - 0.01, wrHi: wrExpected + 0.01, tier: deckTier, share, players }) as DeckStat

const week = (key: string, n: number, share: number) => ({ key, week: n, share, jump: 0 }) as Week

const ladder = (decks: DeckStat[], weeks: Week[] = []): Ladder => {
  const meta = { decks, weeks } as Meta
  return { label: 'TCG', prefix: 'tcg', meta, decks: listed(meta), families: families(decks), answers: new Map() }
}

describe('listed', () => {
  it('keeps plain decks past the floors, best expected rate first', () => {
    const meta = { decks: [deck('1', 0.5, 4), deck('2', 0.56, 1), deck('2*', 0.57, 1), deck('', 0.6, null), deck('3', 0.6, null, 0.004), deck('4', 0.6, null, 0.1, 9)] } as Meta
    expect(listed(meta).map((d) => d.key)).toEqual(['2', '1'])
  })
})

describe('tier', () => {
  it('reads the tier the API gave', () => {
    const l = ladder([deck('1', 0.56, 1), deck('2', 0.545, 1.5), deck('3', 0.5, null)])
    expect(tier(l, 1).map((d) => d.key)).toEqual(['1'])
    expect(tier(l, 1.5).map((d) => d.key)).toEqual(['2'])
    expect(tier(l, 4)).toEqual([])
  })
})

describe('leaders', () => {
  it('holds for one Tier 1 deck', () => {
    expect(leaders(ladder([deck('1', 0.562, 1, 0.12)]))).toBe('**Deck 1** sits alone in Tier 1 with 12.0% of the meta and an expected 56.2% win rate.')
  })

  it('holds for several', () => {
    expect(leaders(ladder([deck('1', 0.56, 1), deck('2', 0.55, 1)]))).toContain('share Tier 1.')
  })
})

describe('risers and fallers', () => {
  const decks = [deck('1*', 0.5, null, 0.3), deck('1', 0.56, 1, 0.2), deck('1>2', 0.55, 2, 0.1), deck('3*', 0.5, null, 0.1), deck('3', 0.54, null, 0.1), deck('5*', 0.5, null, 0.1), { ...deck('5', 0.5, null, 0.1), players: 3 }]
  const l = ladder(decks, [week('1', 1, 0.1), week('1', 2, 0.12), week('1>2', 1, 0.05), week('1>2', 2, 0.07), week('3', 1, 0.1), week('3', 2, 0.08), week('5', 1, 0.1), week('5', 2, 0.2)])

  it('orders the families by their summed move, biggest first, each with its most played listed member', () => {
    expect(risers(l).map((m) => [m.family.key, m.deck?.key])).toEqual([['5*', undefined], ['1*', '1']])
    expect(risers(l)[1]!.delta).toBeCloseTo(0.04)
    expect(fallers(l).map((m) => [m.family.key, m.deck?.key])).toEqual([['3*', '3']])
  })

  it('has no deck for a family none of whose members is listed', () => {
    expect(risers(l)[0]!.deck).toBeNull()
  })

  it('has none in the first week', () => {
    expect(risers(ladder([deck('1*', 0.5, null), deck('1', 0.56, 1)], [week('1', 1, 0.1)]))).toEqual([])
    expect(fallers(ladder([deck('1*', 0.5, null), deck('1', 0.56, 1)], [week('1', 1, 0.1)]))).toEqual([])
  })
})

describe('deckFaces', () => {
  it('prefers the sample cover and gives no two decks the same card', () => {
    const faces = deckFaces([
      { deck: { key: 'a' }, cards: [{ card: 1 }], sampleDeck: { coverCardId: 9 } },
      { deck: { key: 'b' }, cards: [{ card: 9 }, { card: 8 }], sampleDeck: null },
      { deck: { key: 'c' }, cards: [], sampleDeck: null },
    ])
    expect(faces.get('a')).toBe(9)
    expect(faces.get('b')).toBe(8)
    expect(faces.has('c')).toBe(false)
  })
})

describe('name', () => {
  it('falls back to the key', () => {
    expect(name({ key: '207', name: null })).toBe('Archetype 207')
  })
})
