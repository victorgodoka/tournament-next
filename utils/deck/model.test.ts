import { describe, expect, it } from 'vitest'
import { copiesOf, addCard, moveCard, removeCard, reorder, sortZone, splitExtra, canonicalId, isExtraDeckCard, frameOf } from './model'
import { EMPTY_DECK, type CardData } from './types'

const card = (id: number, patch: Partial<CardData>): CardData =>
  ({ id, name: `c${id}`, kind: 'monster', monsterTypes: [], level: null, alias: null, ruleId: null, ...patch }) as CardData

const ash = card(1, { name: 'Ash Blossom', monsterTypes: ['effect'], level: 3 })
const dm = card(2, { name: 'Dark Magician', monsterTypes: ['normal'], level: 7 })
const dmAlt = card(3, { name: 'Dark Magician', monsterTypes: ['normal'], level: 7, alias: dm.id })
const harpie = card(4, { name: 'Harpie Lady', monsterTypes: ['normal'], level: 4 })
const harpie2 = card(5, { name: 'Harpie Lady 2', monsterTypes: ['normal'], level: 4, ruleId: harpie.id })
const utopia = card(6, { name: 'Utopia', monsterTypes: ['xyz', 'effect'], level: 4 })
const pot = card(7, { name: 'Pot of Greed', kind: 'spell' })
const imperm = card(8, { name: 'Infinite Impermanence', kind: 'trap' })
const big = card(9, { name: 'Big Effect', monsterTypes: ['effect'], level: 8 })
const plain = card(10, { name: 'Plain Normal', monsterTypes: ['normal'], level: 4 })
const cards = new Map([ash, dm, dmAlt, harpie, harpie2, utopia, pot, imperm, big, plain].map((c) => [c.id, c]))

describe('deck model', () => {
  it('detects extra-deck cards and canonical ids', () => {
    expect(isExtraDeckCard(utopia)).toBe(true)
    expect(isExtraDeckCard(ash)).toBe(false)
    expect(canonicalId(dmAlt)).toBe(dm.id)
    expect(canonicalId(harpie2)).toBe(harpie.id)
    expect(canonicalId(ash)).toBe(ash.id)
  })

  it('reads the frame: first special frame, else normal/effect; spells and traps by kind', () => {
    const pendulumXyz = card(11, { monsterTypes: ['xyz', 'pendulum', 'effect'] })
    const tunerNormal = card(12, { monsterTypes: ['normal', 'tuner'] })
    expect([ash, dm, utopia, pendulumXyz, tunerNormal, pot, imperm].map(frameOf)).toEqual(['effect', 'normal', 'xyz', 'xyz', 'normal', 'spell', 'trap'])
  })

  it('routes extra-deck monsters to Extra unless a zone is given', () => {
    expect(addCard(EMPTY_DECK, utopia, cards).deck.extra).toEqual([utopia.id])
    expect(addCard(EMPTY_DECK, utopia, cards, 'side').deck.side).toEqual([utopia.id])
    expect(addCard(EMPTY_DECK, ash, cards).deck.main).toEqual([ash.id])
  })

  it('rejects a card in the wrong zone', () => {
    expect(addCard(EMPTY_DECK, utopia, cards, 'main').rejected).toBe('zone')
    expect(addCard(EMPTY_DECK, ash, cards, 'extra').rejected).toBe('zone')
  })

  it('counts alternate artworks and always-treated-as cards as one card', () => {
    const deck = { main: [dm.id, dm.id], extra: [], side: [dmAlt.id] }
    expect(copiesOf(deck, dmAlt, cards)).toBe(3)
    expect(addCard(deck, dm, cards).rejected).toBe('copies')
    expect(addCard(deck, dm, cards).deck).toBe(deck)
    expect(copiesOf({ main: [harpie.id, harpie2.id], extra: [], side: [] }, harpie, cards)).toBe(2)
  })

  it('counts a passcode missing from the map as itself', () => {
    expect(copiesOf({ main: [999, 999], extra: [], side: [] }, card(999, {}), cards)).toBe(2)
  })

  it('rejects a full zone', () => {
    const full = { ...EMPTY_DECK, main: Array(60).fill(pot.id) }
    const res = addCard(full, ash, cards)
    expect(res.rejected).toBe('full')
    expect(res.deck).toBe(full)
  })

  it('checks zone before copies before full', () => {
    const deck = { main: Array(60).fill(ash.id), extra: [], side: [] }
    expect(addCard(deck, ash, cards, 'extra').rejected).toBe('zone')
    expect(addCard(deck, ash, cards).rejected).toBe('copies')
  })

  it('removes the last copy only', () => {
    expect(removeCard({ main: [ash.id, pot.id, ash.id], extra: [], side: [] }, 'main', ash.id).main).toEqual([ash.id, pot.id])
  })

  it('returns the same deck when removing or reordering something not there', () => {
    const deck = { main: [1, 2, 3], extra: [], side: [] }
    expect(removeCard(deck, 'main', 99)).toBe(deck)
    expect(reorder(deck, 'main', 5, 0)).toBe(deck)
  })

  it('moves between zones and keeps order inside a zone', () => {
    expect(moveCard({ main: [ash.id], extra: [], side: [] }, 'main', ash.id, 'side', cards).deck).toEqual({ main: [], extra: [], side: [ash.id] })
    expect(reorder({ main: [1, 2, 3], extra: [], side: [] }, 'main', 0, 2).main).toEqual([2, 3, 1])
  })

  it('keeps the original deck when a move is rejected', () => {
    const deck = { main: [ash.id], extra: [], side: [] }
    const bad = moveCard(deck, 'main', ash.id, 'extra', cards)
    expect(bad.rejected).toBe('zone')
    expect(bad.deck).toBe(deck)
  })

  it('moves an unknown passcode through Side but leaves main<->extra alone', () => {
    const deck = { main: [999], extra: [], side: [] }
    expect(moveCard(deck, 'main', 999, 'side', cards).deck).toEqual({ main: [], extra: [], side: [999] })
    expect(moveCard({ main: [], extra: [], side: [999] }, 'side', 999, 'main', cards).deck).toEqual(deck)
    const res = moveCard(deck, 'main', 999, 'extra', cards)
    expect(res).toEqual({ deck, rejected: null })
    expect(res.deck).toBe(deck)
  })

  it('does not apply the copies check to a move, only zone and full', () => {
    const over = { main: Array(4).fill(ash.id), extra: [], side: [] }
    expect(moveCard(over, 'main', ash.id, 'side', cards)).toEqual({ deck: { main: Array(3).fill(ash.id), extra: [], side: [ash.id] }, rejected: null })
    const fullSide = { main: [ash.id], extra: [], side: Array(15).fill(pot.id) }
    const res = moveCard(fullSide, 'main', ash.id, 'side', cards)
    expect(res.rejected).toBe('full')
    expect(res.deck).toBe(fullSide)
  })

  it('returns the same deck when reordering onto the same index', () => {
    const deck = { main: [1, 2, 3], extra: [], side: [] }
    expect(reorder(deck, 'main', 1, 1)).toBe(deck)
  })

  it('sorts in game order: monsters by frame then level desc then name, spells, traps', () => {
    expect(sortZone([imperm.id, pot.id, ash.id, big.id, plain.id], cards)).toEqual([plain.id, big.id, ash.id, pot.id, imperm.id])
  })

  it('sorts unknown passcodes last in their original order', () => {
    expect(sortZone([777, ash.id, 555], cards)).toEqual([ash.id, 777, 555])
  })

  it('splits a combined main+extra list by card type', () => {
    expect(splitExtra([ash.id, utopia.id], cards)).toEqual({ main: [ash.id], extra: [utopia.id] })
  })
})
