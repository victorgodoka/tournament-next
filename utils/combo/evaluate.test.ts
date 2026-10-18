import { describe, expect, it } from 'vitest'
import type { DeckCard } from './deck-cards'
import { drawCount, estimateCompositions, evaluate, type Evaluation } from './evaluate'
import { choose } from './hypergeometric'
import { DEFAULT_DRAW, type Analysis, type Roles, type Rule, type Subject } from './types'

const card = (id: number, copies: number): DeckCard => ({ id, copies, card: null, passcode: id })
/** `count` distinct one-copy cards, ids `from..from + count - 1`. */
const fill = (from: number, count: number): DeckCard[] => Array.from({ length: count }, (_, i) => card(from + i, 1))
const rule = (subject: Subject, min: number, max: number | null = null): Rule => ({ subject, min, max })

const STARTER = { kind: 'role', role: 'Starter' } as const
const TRAP = { kind: 'role', role: 'Hand Trap' } as const
const BRICK = { kind: 'role', role: 'Brick' } as const

/** Every n-subset of the expanded card list, counting those any hand passes. */
const oracle = (ids: number[], roles: Roles, analysis: Analysis, n: number): bigint => {
  let hits = 0n
  const count = (hand: number[], s: Subject) =>
    hand.filter((id) => (s.kind === 'card' ? id === s.id : (roles.get(id) ?? []).includes(s.role))).length
  const passes = (hand: number[]) =>
    analysis.hands.some((h) => h.rules.every((r) => count(hand, r.subject) >= r.min && (r.max === null || count(hand, r.subject) <= r.max)))
  const walk = (start: number, hand: number[]) => {
    if (hand.length === n) {
      if (passes(hand)) hits++
      return
    }
    for (let i = start; i < ids.length; i++) walk(i + 1, [...hand, ids[i]!])
  }
  walk(0, [])
  return hits
}

describe('evaluate', () => {
  it('counts an overlapping role once: {Starter, Engine} x3 + {Starter} x3 in 40', () => {
    const cards = [card(1, 3), card(2, 3), ...fill(3, 34)]
    const roles = new Map([[1, ['Starter', 'Engine']], [2, ['Starter']]])
    const r = evaluate(cards, roles, { hands: [{ name: 'h', rules: [rule(STARTER, 1)] }] }, DEFAULT_DRAW)
    expect(r).toMatchObject({ any: { favorable: 379752n, total: 658008n }, draw: 5, deckSize: 40 })
  })
  it('matches a brute-force oracle on AND, OR, max, max 0, a named card and 0-copy cards', () => {
    // 12 cards, 5 drawn: A x3 Starter, B x2 Hand Trap, C x2 Brick, D x1 Starter+Hand Trap, 4 fillers, E x0 Starter.
    const cards = [card(1, 3), card(2, 2), card(3, 2), card(4, 1), ...fill(5, 4), card(9, 0)]
    const roles = new Map([[1, ['Starter']], [2, ['Hand Trap']], [3, ['Brick']], [4, ['Starter', 'Hand Trap']], [9, ['Starter']]])
    const analyses: Analysis[] = [
      { hands: [{ name: 'a', rules: [rule(STARTER, 1), rule(TRAP, 1)] }] },
      { hands: [{ name: 'a', rules: [rule(STARTER, 1)] }, { name: 'b', rules: [rule(TRAP, 2)] }] },
      { hands: [{ name: 'a', rules: [rule(STARTER, 1, 1), rule(BRICK, 0, 0)] }] },
      { hands: [{ name: 'a', rules: [rule({ kind: 'card', id: 4 }, 1)] }, { name: 'b', rules: [rule({ kind: 'card', id: 9 }, 1)] }] },
    ]
    for (const analysis of analyses) {
      const r = evaluate(cards, roles, analysis, { ...DEFAULT_DRAW, handSize: 5 })
      expect('error' in r).toBe(false)
      const ids = cards.flatMap((c) => Array<number>(c.copies).fill(c.id))
      expect((r as Evaluation).any.favorable).toBe(oracle(ids, roles, analysis, 5))
      expect((r as Evaluation).any.total).toBe(choose(12, 5))
    }
  })
  it('reports each hand and the union, not their sum', () => {
    const cards = [card(1, 3), card(2, 3), ...fill(3, 34)]
    const roles = new Map([[1, ['Starter']], [2, ['Hand Trap']]])
    const r = evaluate(cards, roles, { hands: [{ name: 'a', rules: [rule(STARTER, 1)] }, { name: 'b', rules: [rule(TRAP, 1)] }] }, DEFAULT_DRAW) as Evaluation
    expect(r.hands.map((h) => h.odds.favorable)).toEqual([222111n, 222111n])
    expect(r.hands.map((h) => h.name)).toEqual(['a', 'b'])
    expect(r.any.favorable).toBeLessThan(444222n)
    expect(r.any.favorable).toBe(658008n - choose(34, 5))
  })
  it('draw count and refusals', () => {
    expect(drawCount(DEFAULT_DRAW)).toBe(5)
    expect(drawCount({ going: 'second', handSize: null, extraDraws: 0, turn: 1 })).toBe(6)
    expect(drawCount({ going: 'first', handSize: 7, extraDraws: 2, turn: 3 })).toBe(11)
    expect(evaluate(fill(1, 12), new Map(), { hands: [] }, { ...DEFAULT_DRAW, handSize: 20 })).toEqual({ error: 'tooFewCards' })
    expect(estimateCompositions(2, 5)).toBe(21n)
    expect(estimateCompositions(0, 5)).toBe(1n)
    const many = fill(1, 40)
    const roles = new Map(many.map((c) => [c.id, [`r${c.id}`]]))
    const hands = many.map((c) => ({ name: String(c.id), rules: [rule({ kind: 'role', role: `r${c.id}` }, 1)] }))
    expect(evaluate(many, roles, { hands }, { ...DEFAULT_DRAW, handSize: 20 })).toEqual({ error: 'tooComplex' })
  })
  it('an empty analysis evaluates to zero hands and p 0', () => {
    expect(evaluate(fill(1, 40), new Map(), { hands: [] }, DEFAULT_DRAW)).toMatchObject({ hands: [], any: { favorable: 0n, total: 658008n, p: 0 } })
  })
})
