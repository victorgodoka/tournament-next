import { describe, expect, it } from 'vitest'
import type { DeckCard } from './deck-cards'
import { evaluate, type Evaluation } from './evaluate'
import { nextSeed, rng } from './rng'
import {
  addCounts,
  banishable,
  dealHand,
  drawOne,
  estimate,
  expandIds,
  handPasses,
  monteCarlo,
  newPile,
  pickExcavated,
  poolSize,
  putBack,
  resolveEffects,
  standardError,
  type Context,
  type Estimate,
} from './simulate'
import { DEFAULT_DRAW, DEFAULT_EFFECTS, DRAW_EFFECTS, type Analysis, type Roles, type Rule, type Subject } from './types'

const card = (id: number, copies: number): DeckCard => ({ id, copies, card: null, passcode: id })
/** `count` distinct one-copy cards, ids `from..from + count - 1`. */
const fill = (from: number, count: number): DeckCard[] => Array.from({ length: count }, (_, i) => card(from + i, 1))
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

describe('deal and Monte Carlo', () => {
  // 40 cards: 3 Starters, 3 Traps, 34 filler
  const deck = [card(1, 3), card(2, 3), ...fill(200, 34)]

  it('deals the same hand for a seed, another for the next seed, and Draw next keeps the first cards', () => {
    const a = dealHand(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 42)
    expect(a.hand).toHaveLength(5)
    expect(a.left).toBe(35)
    expect(dealHand(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 42).hand).toEqual(a.hand)
    expect(dealHand(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, nextSeed(42)).hand).not.toEqual(a.hand)
    const more = dealHand(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 42, 2)
    expect(more.hand.slice(0, 5)).toEqual(a.hand)
    expect(more.hand).toHaveLength(7)
    expect(more.left).toBe(33)
    expect(more.hand.filter((id) => id === 1).length).toBeLessThanOrEqual(3)
    expect(a.passes).toEqual(analysis.hands.map((h) => handPasses(a.hand, roles, h)))
    expect(a.any).toBe(a.passes.some(Boolean))
    expect(a.log).toEqual([])
  })
  it('deals what the deck has when it is shorter than the draw, and logs a toggled effect', () => {
    const short = dealHand([card(1, 3)], roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 0, 1)
    expect(short.hand).toEqual([1, 1, 1])
    expect(short.left).toBe(0)
    const pots = dealHand([card(D.desires, 40)], roles, analysis, DEFAULT_DRAW, { ...DEFAULT_EFFECTS, resolve: [D.desires] }, 15, 1)
    expect(pots.log[0]).toMatchObject({ effect: 'desires', skipped: null })
    expect(pots.hand).toHaveLength(6)
    expect(pots.left).toBe(23)
  })
  it('monteCarlo lands within 3 standard errors of evaluate at 50k runs', () => {
    const exact = evaluate(deck, roles, analysis, DEFAULT_DRAW) as Evaluation
    const counts = monteCarlo(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 50_000, rng(1))
    expect(counts.runs).toBe(50_000)
    const est = estimate(counts, exact)
    expect(est.runs).toBe(50_000)
    const pairs: [Estimate, number][] = [
      [est.hands[0]!, exact.hands[0]!.odds.p],
      [est.hands[1]!, exact.hands[1]!.odds.p],
      [est.any, exact.any.p],
    ]
    for (const [e, p] of pairs) {
      expect(Math.abs(e.rate - p)).toBeLessThanOrEqual(3 * standardError(p, 50_000))
      expect(e.exact).toBe(p)
      expect(e.diff).toBeCloseTo((e.rate - p) * 100, 10)
      expect(e.halfWidth).toBeCloseTo(1.96 * standardError(e.rate, 50_000), 12)
    }
  })
  it('counts add across chunks; without an exact result the estimate leaves exact and diff null', () => {
    const r = rng(5)
    const a = monteCarlo(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 5_000, r)
    const b = monteCarlo(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 5_000, r)
    const sum = addCounts(a, b)
    expect(sum.runs).toBe(10_000)
    expect(sum.hits).toEqual([a.hits[0]! + b.hits[0]!, a.hits[1]! + b.hits[1]!])
    expect(sum.any).toBe(a.any + b.any)
    expect(estimate(sum, null).any).toEqual({ rate: sum.any / 10_000, exact: null, diff: null, halfWidth: 1.96 * standardError(sum.any / 10_000, 10_000) })
    expect(estimate({ runs: 0, hits: [0, 0], any: 0 }, null).any.rate).toBe(0)
    expect(standardError(0.5, 10_000)).toBeCloseTo(0.005, 12)
    expect(standardError(0.5, 0)).toBe(0)
  })
  it('three Upstarts raise the Starter odds well past the exact figure without them', () => {
    const upstarts = [card(1, 3), card(D.upstart, 3), ...fill(200, 34)]
    const exact = evaluate(upstarts, roles, analysis, DEFAULT_DRAW) as Evaluation
    const est = estimate(monteCarlo(upstarts, roles, analysis, DEFAULT_DRAW, { ...DEFAULT_EFFECTS, resolve: [D.upstart] }, 15, 50_000, rng(2)), exact)
    expect(est.hands[0]!.rate).toBeGreaterThan(exact.hands[0]!.odds.p + 3 * standardError(exact.hands[0]!.odds.p, 50_000))
  })
})
