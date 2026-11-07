import { describe, expect, it } from 'vitest'
import { deckFaces, families, reportDeck, reportMoves, tierListDecks, type DeckStat, type Meta, type Week } from '@utils/statistics'
import { behind, fallers, gapPoints, leaders, listed, name, risers, rulesOf, tier, type Ladder, type TierRules } from './tier-list'

const RULES: TierRules = { t1Gap: 0.0075, t2Gap: 0.0125, t3Gap: 0.025, minShare: 0.005, minPlayers: 10 }

const deck = (key: string, wrExpected: number, deckTier: DeckStat['tier'], share = 0.1, players = 50) =>
  ({ key, name: `Deck ${key}`, wrExpected, wrLo: wrExpected - 0.01, wrHi: wrExpected + 0.01, tier: deckTier, share, players }) as DeckStat

const week = (key: string, n: number, share: number) => ({ key, week: n, share, jump: 0 }) as Week

const ladder = (decks: DeckStat[], weeks: Week[] = []): Ladder => {
  const meta = { decks, weeks } as Meta
  return { label: 'TCG', prefix: 'tcg', meta, rules: RULES, decks: listed(meta), families: families(decks), answers: new Map() }
}

describe('listed', () => {
  it('keeps the plain decks the API tiered, best expected rate first', () => {
    const meta = { decks: [deck('1', 0.5, 4), deck('2', 0.56, 1), deck('2*', 0.57, 1), deck('', 0.6, null), deck('3', 0.6, null, 0.004), deck('4', 0.6, null, 0.1, 9)] } as Meta
    expect(listed(meta).map((d) => d.key)).toEqual(['2', '1'])
  })

  it('breaks a tie on expected rate by key, as the server does', () => {
    const meta = { decks: [deck('z', 0.55, 1.5), deck('x', 0.55, 1), deck('y', 0.55, 1)] } as Meta
    expect(listed(meta).map((d) => d.key)).toEqual(['x', 'y', 'z'])
  })
})

describe('rulesOf', () => {
  it('reads the relative rules the build ran with', () => {
    expect(rulesOf({ fit: { tiers: RULES } } as unknown as Meta, 'TCG')).toEqual(RULES)
  })

  it('refuses a build without them or with the old absolute anchors', () => {
    expect(() => rulesOf({ fit: { tiers: null } } as unknown as Meta, 'TCG')).toThrow(/no relative tier rules/)
    expect(() => rulesOf({ fit: {} } as unknown as Meta, 'TCG')).toThrow(/no relative tier rules/)
    const old = { t1: 0.55, t15: 0.54, t2: 0.525, t3: 0.51, t4: 0.5, minShare: 0.005, minPlayers: 10 }
    expect(() => rulesOf({ fit: { tiers: old } } as unknown as Meta, 'Genesys')).toThrow(/Genesys build/)
  })
})

describe('gapPoints and behind', () => {
  it('writes a gap as points without trailing zeros', () => {
    expect([RULES.t1Gap, RULES.t2Gap, RULES.t3Gap].map(gapPoints)).toEqual(['0.75', '1.25', '2.5'])
  })

  it('measures points under the leader', () => {
    const l = ladder([deck('1', 0.56, 1), deck('2', 0.545, 2)])
    expect(behind(l, l.decks[0]!)).toBe(0)
    expect(behind(l, l.decks[1]!)).toBeCloseTo(1.5)
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
    expect(leaders(ladder([deck('1', 0.562, 1, 0.12)]))).toBe('**Deck 1** holds Tier 1 alone, with an expected 56.2% win rate and 12.0% of the meta.')
  })

  it('holds for two, with the gap between them', () => {
    expect(leaders(ladder([deck('1', 0.56, 1), deck('2', 0.555, 1)]))).toContain('share Tier 1, 0.5 points apart.')
  })
})

describe('risers and fallers', () => {
  const decks = [deck('1*', 0.5, null, 0.3), deck('1', 0.56, 1, 0.2), deck('1>2', 0.55, 2, 0.1), deck('3*', 0.5, null, 0.1), deck('3', 0.54, 4, 0.1), deck('5*', 0.5, null, 0.1), { ...deck('5', 0.5, null, 0.1), players: 3 }]
  const l = ladder(decks, [week('1', 1, 0.1), week('1', 2, 0.12), week('1>2', 1, 0.05), week('1>2', 2, 0.07), week('3', 1, 0.1), week('3', 2, 0.08), week('5', 1, 0.1), week('5', 2, 0.2)])

  it('keeps Tiers 1–3, sums family moves and excludes T4 and unranked families', () => {
    expect(risers(l).map((m) => [m.family.key, m.deck?.key])).toEqual([['1*', '1']])
    expect(risers(l)[0]!.delta).toBeCloseTo(0.04)
    expect(fallers(l)).toEqual([])
  })

  it('filters before choosing the top mover, so an excluded family does not consume a slot', () => {
    expect(reportMoves(l.meta, 1).risers[0]!.deck.key).toBe('1')
  })

  it('has none in the first week', () => {
    expect(risers(ladder([deck('1*', 0.5, null), deck('1', 0.56, 1)], [week('1', 1, 0.1)]))).toEqual([])
    expect(fallers(ladder([deck('1*', 0.5, null), deck('1', 0.56, 1)], [week('1', 1, 0.1)]))).toEqual([])
  })
})

describe('editorial tier coverage', () => {
  it('shows all Tiers 1–3 and only the five strongest T4 builds without changing the input', () => {
    const decks = [deck('top', 0.6, 1), deck('third', 0.55, 3), ...Array.from({ length: 8 }, (_, i) => deck(`fourth-${i}`, 0.54 - i / 100, 4)), deck('unknown', 0.7, null)]
    expect(tierListDecks([...decks].reverse()).map((d) => d.key)).toEqual(['top', 'third', 'fourth-0', 'fourth-1', 'fourth-2', 'fourth-3', 'fourth-4'])
    expect(decks).toHaveLength(11)
  })

  it('accepts a deck promoted from T4 once its current tier is T3, and excludes demotions', () => {
    expect(reportDeck(deck('promoted', 0.55, 3))).toBe(true)
    expect(reportDeck(deck('demoted', 0.5, 4))).toBe(false)
    expect(reportDeck(null)).toBe(false)
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

  it("puts the panel's cover first, and skips it when a better deck took it", () => {
    const faces = deckFaces([
      { deck: { key: 'a', face: 5 }, cards: [{ card: 1 }], sampleDeck: { coverCardId: 9 } },
      { deck: { key: 'b', face: 5 }, cards: [{ card: 7 }], sampleDeck: null },
      { deck: { key: 'c', face: 6 }, cards: [], sampleDeck: null },
    ])
    expect(faces.get('a')).toBe(5)
    expect(faces.get('b')).toBe(7)
    expect(faces.get('c')).toBe(6)
  })
})

describe('name', () => {
  it('falls back to the key', () => {
    expect(name({ key: '207', name: null })).toBe('Archetype 207')
    expect(name({ key: '207*', name: null })).toBe('Archetype 207')
  })

  it('drops what the wiki would read as raw HTML', () => {
    expect(name({ key: '1', name: 'Maliss <P>' })).toBe('Maliss P')
  })
})
