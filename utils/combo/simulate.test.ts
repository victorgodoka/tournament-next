import { describe, expect, it } from 'vitest'
import type { DeckCard } from './deck-cards'
import { rng } from './rng'
import { banishable, drawOne, expandIds, handPasses, newPile, pickExcavated, poolSize, putBack, resolveEffects, type Context } from './simulate'
import { DRAW_EFFECTS, type Analysis, type Roles, type Rule, type Subject } from './types'

const card = (id: number, copies: number): DeckCard => ({ id, copies, card: null, passcode: id })
const rule = (subject: Subject, min: number, max: number | null = null): Rule => ({ subject, min, max })
const STARTER = { kind: 'role', role: 'Starter' } as const
const TRAP = { kind: 'role', role: 'Hand Trap' } as const
const D = DRAW_EFFECTS
/** `n` untagged ids, 200 up. */
const rest = (n: number) => Array.from({ length: n }, (_, i) => 200 + i)

const roles: Roles = new Map([[1, ['Starter']], [2, ['Hand Trap']]])
const analysis: Analysis = {
  hands: [
    { name: 'A', rules: [rule(STARTER, 1)] },
    { name: 'B', rules: [rule(STARTER, 1), rule(TRAP, 1)] },
  ],
}
const ctx = (resolve: number[], over: Partial<Context> = {}): Context => ({ roles, analysis, effects: { resolve, prosperity: 6, extravagance: 6 }, extraSize: 15, ...over })

describe('pile and hand check', () => {
  it('draws without replacement and puts back', () => {
    const pile = newPile(expandIds([card(1, 2), card(2, 1)]))
    const drawn = [drawOne(pile, rng(1)), drawOne(pile, rng(1)), drawOne(pile, rng(1))].sort()
    expect(drawn).toEqual([1, 1, 2])
    expect(drawOne(pile, rng(1))).toBeUndefined()
    putBack(pile, 2)
    expect(poolSize(pile)).toBe(2)
  })
  it('handPasses counts roles and cards; a hand with no rules never passes', () => {
    expect(handPasses([1, 200, 201], roles, { name: '', rules: [rule(STARTER, 1)] })).toBe(true)
    expect(handPasses([1, 200, 201], roles, { name: '', rules: [rule(STARTER, 1), rule(TRAP, 1)] })).toBe(false)
    expect(handPasses([1, 1, 2], roles, { name: '', rules: [rule({ kind: 'card', id: 1 }, 1, 1)] })).toBe(false) // two copies, max 1
    expect(handPasses([1, 2], roles, { name: '', rules: [] })).toBe(false)
  })
})

describe('draw effects', () => {
  it('Desires banishes 10 and draws 2, leaves the hand, once per turn', () => {
    const hand = [D.desires, D.desires, 200, 201, 202]
    const pile = newPile(rest(35).map((id) => id + 100))
    const log = resolveEffects(hand, pile, ctx([D.desires]), rng(1))
    expect(hand).toHaveLength(6) // 5 − 1 pot + 2 drawn
    expect(hand.filter((c) => c === D.desires)).toHaveLength(1) // the second copy stays
    expect(poolSize(pile)).toBe(35 - 12)
    expect(log.map((l) => [l.effect, l.skipped])).toEqual([['desires', null], ['desires', 'once']])
    expect(log[0]!.drew).toHaveLength(2)
    const thin = [D.desires, 200, 201, 202, 203]
    expect(resolveEffects(thin, newPile(rest(11)), ctx([D.desires]), rng(1))[0]!.skipped).toBe('deck')
    expect(thin).toContain(D.desires)
  })
  it('Prosperity excavates by the toggle, capped by the Extra Deck, and adds the card that completes the first hand', () => {
    const hand = [D.prosperity, 2, 200, 201, 202] // a Trap, no Starter: a Starter completes A (and B)
    const pile = newPile([300, 301, 1, 302, 303, 304]) // exactly 6: all excavated
    const log = resolveEffects(hand, pile, ctx([D.prosperity]), rng(1))
    expect(hand).toEqual([2, 200, 201, 202, 1])
    expect(log[0]).toMatchObject({ effect: 'prosperity', added: 1, skipped: null })
    expect(log[0]!.excavated).toHaveLength(6)
    expect(poolSize(pile)).toBe(0) // the rest went to the bottom
    const capped = [D.prosperity, 200, 201, 202, 203]
    const pile3 = newPile([300, 301, 302, 303])
    expect(resolveEffects(capped, pile3, ctx([D.prosperity], { extraSize: 4 }), rng(1))[0]!.excavated).toHaveLength(3)
    expect(poolSize(pile3)).toBe(1)
    const noExtra = [D.prosperity, 200, 201, 202, 203]
    expect(resolveEffects(noExtra, newPile(rest(10)), ctx([D.prosperity], { extraSize: 2 }), rng(1))[0]!.skipped).toBe('extraDeck')
    expect(noExtra).toContain(D.prosperity)
    expect(banishable(6, 15)).toBe(6)
    expect(banishable(6, 5)).toBe(3)
    expect(banishable(3, 2)).toBe(0)
  })
  it('Duality excavates 3 and shuffles the rest back; the policy falls back to a card that advances a rule, then the first excavated', () => {
    const hand = [D.duality, 200, 201, 202, 203]
    const pile = newPile([300, 2, 301]) // no Starter completes a hand; the Trap advances B
    resolveEffects(hand, pile, ctx([D.duality]), rng(1))
    expect(hand).toEqual([200, 201, 202, 203, 2])
    expect(poolSize(pile)).toBe(2)
    const plain = [D.duality, 200, 201, 202, 203]
    const log = resolveEffects(plain, newPile([300, 301, 302]), ctx([D.duality]), rng(1))
    expect(plain[4]).toBe(log[0]!.excavated[0])
    expect(pickExcavated([300, 1], [2], roles, analysis)).toBe(1) // the Starter completes A given a Trap in hand
  })
  it('Extravagance draws 1 per 3 banished and locks Desires and Upstart', () => {
    const hand = [D.extravagance, D.desires, D.upstart, 200, 201]
    const log = resolveEffects(hand, newPile(rest(30)), ctx([D.extravagance, D.desires, D.upstart]), rng(1))
    expect(log.map((l) => [l.effect, l.skipped])).toEqual([['extravagance', null], ['desires', 'lock'], ['upstart', 'lock']])
    expect(hand).toHaveLength(6) // −1 pot + 2 drawn; Desires and Upstart stay
    expect(resolveEffects([D.extravagance, 200, 201, 202, 203], newPile(rest(30)), ctx([D.extravagance], { extraSize: 5 }), rng(1))[0]!.drew).toHaveLength(1)
  })
  it('an effect drawn by an effect resolves; Upstart has no once-per-turn; Extravagance and Prosperity are locked after a draw', () => {
    const hand = [D.upstart, 200, 201, 202, 203]
    const log = resolveEffects(hand, newPile([D.upstart, D.upstart]), ctx([D.upstart]), rng(1))
    expect(log.map((l) => [l.effect, l.skipped])).toEqual([['upstart', null], ['upstart', null], ['upstart', 'deck']])
    expect(hand).toEqual([200, 201, 202, 203, D.upstart]) // the last copy found an empty deck
    const late = [D.upstart, 200, 201, 202, 203]
    expect(resolveEffects(late, newPile([D.extravagance, D.prosperity]), ctx([D.upstart, D.extravagance, D.prosperity]), rng(1)).map((l) => [l.effect, l.skipped])).toEqual([
      ['upstart', null],
      [expect.stringMatching(/extravagance|prosperity/), 'lock'],
    ])
  })
  it('a resolved Pot leaves the hand before the rules see it', () => {
    const brick: Roles = new Map([...roles, [D.desires, ['Brick']]])
    const noBrick: Analysis = { hands: [{ name: 'C', rules: [rule({ kind: 'role', role: 'Brick' }, 0, 0)] }] }
    const hand = [D.desires, 200, 201, 202, 203]
    expect(handPasses(hand, brick, noBrick.hands[0]!)).toBe(false)
    resolveEffects(hand, newPile(rest(30)), ctx([D.desires], { roles: brick, analysis: noBrick }), rng(1))
    expect(handPasses(hand, brick, noBrick.hands[0]!)).toBe(true)
  })
})
