import { describe, expect, it } from 'vitest'
import type { CardData } from '@utils/deck/types'
import type { Banlist } from '@utils/wiki'
import { canonicalOf, copyLimit, distinctCards, oncePerTurn, withCopies } from './deck-cards'

const magician = { id: 46986414, idOriginal: 46986414, idTcg: null, alias: null, ruleId: null, alternateArts: [46986431], name: 'Dark Magician' } as unknown as CardData
const cards = new Map<number, CardData>([
  [46986414, magician],
  [46986431, magician],
])
const limitedCard = { ...magician, banlists: [{ name: 'TCG', limitation: 1 }] } as unknown as CardData
const tcgList: Banlist = { id: 2, name: 'TCG', format: 'tcg', pointCap: null, bannedTypes: [], cards: 0 }

describe('deck cards', () => {
  it('groups alternate artworks under one canonical card and keeps unknown passcodes', () => {
    const rows = distinctCards([46986414, 46986431, 999, 46986414], cards)
    expect(rows.map((r) => [r.id, r.copies, r.passcode])).toEqual([[46986414, 3, 46986414], [999, 1, 999]])
    expect(rows[1]!.card).toBeNull()
    expect(rows[0]!.card).toBe(magician)
    expect(canonicalOf(46986431, cards)).toBe(46986414)
    expect(canonicalOf(999, cards)).toBe(999)
  })
  it('sets copies in place and appends new ones at the end', () => {
    expect(withCopies([1, 46986414, 2, 46986431], 46986414, 1, cards, 46986414)).toEqual([1, 46986414, 2])
    expect(withCopies([1, 46986414, 2], 46986414, 3, cards, 46986414)).toEqual([1, 46986414, 2, 46986414, 46986414])
    expect(withCopies([1, 2], 7, 2, cards, 7)).toEqual([1, 2, 7, 7])
    expect(withCopies([1, 2], 1, 0, cards, 1)).toEqual([2])
  })
  it('caps copies at the format limit, 3 without one', () => {
    expect(copyLimit(limitedCard, tcgList)).toBe(1)
    expect(copyLimit(limitedCard, null)).toBe(3)
    expect(copyLimit(null, tcgList)).toBe(3)
    expect(copyLimit(magician, tcgList)).toBe(3)
    expect(copyLimit(limitedCard, { ...tcgList, name: 'Genesys', format: 'genesys', pointCap: 100 })).toBe(3)
  })
  it('reads once-per-turn clauses from the card text', () => {
    expect(oncePerTurn('You can only use this effect of "Ash Blossom & Joyous Spring" once per turn.')).toBe('HOPT')
    expect(oncePerTurn('You can only activate 1 "Called by the Grave" per turn.')).toBe('HOPT')
    expect(oncePerTurn('Once per turn: You can target 1 monster; destroy it.')).toBe('OPT')
    expect(oncePerTurn('A dragon with ferocious power.')).toBeNull()
  })
})
