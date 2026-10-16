import { describe, expect, it } from 'vitest'
import { cardStatus, pointsUsed, validate } from './rules'
import { EMPTY_DECK, type CardData, type Deck } from './types'
import type { Banlist } from '@utils/wiki'

const card = (id: number, patch: Partial<CardData> = {}): CardData =>
  ({
    id,
    name: `c${id}`,
    kind: 'spell',
    monsterTypes: [],
    level: null,
    alias: null,
    ruleId: null,
    banlists: null,
    released: { tcg: '2002-03-08', ocg: '1999-11-18' },
    ...patch,
  }) as CardData

const tcg: Banlist = { id: 2, name: 'TCG 18.05.2026', format: 'tcg', pointCap: null, bannedTypes: [], cards: 0 }
const ocg: Banlist = { id: 1, name: 'OCG 01.07.2026', format: 'ocg', pointCap: null, bannedTypes: [], cards: 0 }
const wcs: Banlist = { id: 3, name: 'WCS 01.07.2026', format: 'wcs', pointCap: null, bannedTypes: [], cards: 0 }
const gen: Banlist = { id: 100, name: 'Genesys', format: 'genesys', pointCap: 100, bannedTypes: ['pendulum', 'link'], cards: 0 }
const TODAY = '2026-10-16'

const filler = Array.from({ length: 40 }, (_, i) => card(1000 + i))
const banned = card(1, { banlists: [{ name: 'TCG 18.05.2026', limitation: 0 }] })
const lim = card(2, { banlists: [{ name: 'TCG 18.05.2026', limitation: 1 }] })
const semi = card(3, { banlists: [{ name: 'TCG 18.05.2026', limitation: 2 }] })
const pts60 = card(4, { banlists: [{ name: 'Genesys', limitation: 60 }] })
const linkMon = card(5, { kind: 'monster', monsterTypes: ['link', 'effect'] })
const future = card(6, { released: { tcg: '2027-01-01', ocg: null } })
const dm = card(7, { kind: 'monster', monsterTypes: ['normal'] })
const dmAlt = card(8, { kind: 'monster', monsterTypes: ['normal'], alias: dm.id })
const cards = new Map([...filler, banned, lim, semi, pts60, linkMon, future, dm, dmAlt].map((c) => [c.id, c]))
const free = filler[0]!
const fillerIds = filler.map((c) => c.id)
const deck = (d: Partial<Deck>): Deck => ({ ...EMPTY_DECK, ...d })
const base = (d: Partial<Deck> = {}): Deck => deck({ main: fillerIds, ...d })

describe('validate', () => {
  it('flags an empty main deck', () => {
    expect(validate(EMPTY_DECK, cards, tcg, TODAY)).toEqual([{ code: 'main-size', count: 0, limit: 40 }])
  })

  it('accepts a 40 card deck with no banlist', () => {
    expect(validate(base(), cards, null, TODAY)).toEqual([])
  })

  it('flags a main deck above 60', () => {
    const big = Array.from({ length: 61 }, () => free.id)
    expect(validate(deck({ main: big }), cards, null, TODAY)).toContainEqual({ code: 'main-size', count: 61, limit: 60 })
  })

  it('flags an oversized side deck', () => {
    const side = Array.from({ length: 16 }, (_, i) => 1000 + i)
    expect(validate(base({ side }), cards, null, TODAY)).toEqual([{ code: 'side-size', count: 16, limit: 15 }])
  })

  it('flags an oversized extra deck, after main and before side', () => {
    const ids = Array.from({ length: 16 }, (_, i) => 1000 + i)
    expect(validate(deck({ extra: ids, side: ids }), cards, null, TODAY)).toEqual([
      { code: 'main-size', count: 0, limit: 40 },
      { code: 'extra-size', count: 16, limit: 15 },
      { code: 'side-size', count: 16, limit: 15 },
    ])
  })

  it('flags a forbidden card once', () => {
    const d = base({ side: [banned.id, banned.id] })
    expect(validate(d, cards, tcg, TODAY)).toEqual([{ code: 'forbidden', cardId: banned.id }])
  })

  it('flags a limited card with the copies', () => {
    expect(validate(base({ side: [lim.id, lim.id] }), cards, tcg, TODAY)).toContainEqual({
      code: 'limited',
      cardId: lim.id,
      count: 2,
      limit: 1,
    })
  })

  it('flags a semi-limited card, counting across zones', () => {
    expect(validate(base({ main: [...fillerIds, semi.id, semi.id], side: [semi.id] }), cards, tcg, TODAY)).toContainEqual({
      code: 'semi-limited',
      cardId: semi.id,
      count: 3,
      limit: 2,
    })
  })

  it('does not flag a limited card at its limit', () => {
    expect(validate(base({ side: [lim.id] }), cards, tcg, TODAY)).toEqual([])
  })

  it('flags points over the Genesys cap and computes pointsUsed', () => {
    const d = base({ side: [pts60.id, pts60.id] })
    expect(pointsUsed(d, cards, gen)).toBe(120)
    expect(validate(d, cards, gen, TODAY)).toContainEqual({ code: 'points', count: 120, limit: 100 })
  })

  it('does not flag points at the cap', () => {
    expect(validate(base({ side: [pts60.id] }), cards, gen, TODAY)).toEqual([])
  })

  it('flags a banned type on Genesys', () => {
    expect(validate(base({ extra: [linkMon.id] }), cards, gen, TODAY)).toContainEqual({ code: 'banned-type', cardId: linkMon.id })
  })

  it('flags unreleased cards by region', () => {
    const d = base({ side: [future.id] })
    expect(validate(d, cards, tcg, TODAY)).toEqual([{ code: 'unreleased', cardId: future.id }])
    expect(validate(d, cards, ocg, TODAY)).toEqual([{ code: 'unreleased', cardId: future.id }])
    expect(validate(d, cards, wcs, TODAY)).toEqual([])
    expect(validate(d, cards, null, TODAY)).toEqual([])
  })

  it('counts alternate artworks as one card', () => {
    const d = base({ side: [dm.id, dm.id, dmAlt.id, dmAlt.id] })
    expect(validate(d, cards, null, TODAY)).toContainEqual({ code: 'copies', cardId: dm.id, count: 4, limit: 3 })
    expect(validate(d, cards, null, TODAY).filter((p) => p.code === 'copies')).toHaveLength(1)
  })

  it('takes the strictest limit across prints, in any deck order', () => {
    const harpie = card(60, { banlists: [{ name: 'TCG 18.05.2026', limitation: 1 }] })
    const harpie1 = card(61, { ruleId: harpie.id })
    const map = new Map([...cards, [harpie.id, harpie], [harpie1.id, harpie1]])
    const expected = { code: 'limited', cardId: harpie.id, count: 3, limit: 1 }
    expect(validate(base({ side: [harpie1.id, harpie.id, harpie.id] }), map, tcg, TODAY)).toContainEqual(expected)
    expect(validate(base({ side: [harpie.id, harpie.id, harpie1.id] }), map, tcg, TODAY)).toContainEqual(expected)
  })

  it('charges every copy the highest-cost print of the group', () => {
    const orig = card(62, { banlists: [{ name: 'Genesys', limitation: 30 }] })
    const alt = card(63, { alias: orig.id })
    const map = new Map([...cards, [orig.id, orig], [alt.id, alt]])
    expect(pointsUsed(base({ side: [alt.id, alt.id, orig.id] }), map, gen)).toBe(90)
    expect(pointsUsed(base({ side: [orig.id, alt.id, alt.id] }), map, gen)).toBe(90)
  })

  it('reports only the copy limit when a limited card exceeds both limits', () => {
    expect(validate(base({ side: [lim.id, lim.id, lim.id, lim.id] }), cards, tcg, TODAY)).toEqual([
      { code: 'limited', cardId: lim.id, count: 4, limit: 1 },
    ])
  })

  it('reports copies for a free card above 3', () => {
    // `free` already has one copy in main; three more in side makes four.
    expect(validate(base({ side: [free.id, free.id, free.id] }), cards, tcg, TODAY)).toEqual([
      { code: 'copies', cardId: free.id, count: 4, limit: 3 },
    ])
  })

  it('flags an unknown passcode once, even without a banlist', () => {
    expect(validate(base({ side: [999, 999] }), cards, null, TODAY)).toEqual([{ code: 'unknown-card', cardId: 999 }])
  })

  it('orders card problems by first appearance, and within a card by kind', () => {
    const both = card(50, {
      monsterTypes: ['link'],
      banlists: [{ name: 'TCG 18.05.2026', limitation: 1 }],
      released: { tcg: '2027-01-01', ocg: null },
    })
    const map = new Map([...cards, [both.id, both]])
    const t: Banlist = { ...tcg, bannedTypes: ['link'] }
    const d = base({ side: [both.id, both.id, banned.id] })
    expect(validate(d, map, t, TODAY).map((p) => p.code)).toEqual(['limited', 'banned-type', 'unreleased', 'forbidden'])
  })
})

describe('cardStatus', () => {
  it('reads copies from the matching list by name', () => {
    expect(cardStatus(banned, tcg)).toEqual({ copies: 0 })
    expect(cardStatus(lim, tcg)).toEqual({ copies: 1 })
    expect(cardStatus(semi, tcg)).toEqual({ copies: 2 })
  })

  it('treats a card absent from the list as free', () => {
    expect(cardStatus(free, tcg)).toEqual({ copies: 3 })
    expect(cardStatus(banned, ocg)).toEqual({ copies: 3 })
    expect(cardStatus(free, gen)).toEqual({ points: 0 })
  })

  it('reads points on a Genesys list', () => {
    expect(cardStatus(pts60, gen)).toEqual({ points: 60 })
  })
})
