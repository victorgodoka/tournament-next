import { describe, expect, it } from 'vitest'
import type { DeckCard } from './deck-cards'
import { evaluate, type Evaluation } from './evaluate'
import { copiesFor, sweepCopies, sweepDeckSize, sweepTurn, type SweepPoint } from './sweep'
import { DEFAULT_DRAW, type Analysis, type Roles } from './types'

const card = (id: number, copies: number): DeckCard => ({ id, copies, card: null, passcode: id })
const fill = (from: number, count: number): DeckCard[] => Array.from({ length: count }, (_, i) => card(from + i, 1))
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

const STARTER = { kind: 'role', role: 'Starter' } as const
const analysis: Analysis = {
  hands: [
    { name: 'a', rules: [{ subject: STARTER, min: 1, max: null }] },
    { name: 'b', rules: [{ subject: { kind: 'card', id: 2 }, min: 1, max: null }] },
  ],
}
// 40 cards: card 1 ×2 Starter, card 2 ×1 (named by a rule), 37 filler
const cards = [card(1, 2), card(2, 1), ...fill(3, 37)]
const roles: Roles = new Map([[1, ['Starter']]])
const ev = (c: DeckCard[], draw = DEFAULT_DRAW) => evaluate(c, roles, analysis, draw) as Evaluation

describe('sweep', () => {
  it('copies: endpoints match evaluate and the deck size holds while filler lasts', () => {
    const pts = sweepCopies(cards, roles, analysis, DEFAULT_DRAW, 1, 3)
    expect(pts.map((p) => [p.x, p.deckSize])).toEqual([[0, 40], [1, 40], [2, 40], [3, 40]])
    expect(pts[0]!.any).toBe(ev([card(1, 0), card(2, 1), ...fill(3, 39)]).any.p)
    expect(pts[3]!.any).toBe(ev([card(1, 3), card(2, 1), ...fill(3, 36)]).any.p)
    expect(pts[2]!.hands).toEqual(ev(cards).hands.map((h) => h.odds.p))
    expect(sweepCopies(cards, roles, analysis, DEFAULT_DRAW, 99, 3)).toEqual([])
  })
  it('copies: with no filler the deck grows; a card no rule names gives flat lines', () => {
    const tight = [card(1, 1), card(2, 1), card(3, 1)]
    const all: Roles = new Map([[1, ['Starter']], [3, ['Starter']]])
    const draw = { ...DEFAULT_DRAW, handSize: 2 }
    expect(sweepCopies(tight, all, analysis, draw, 1, 3).map((p) => [p.x, p.deckSize])).toEqual([[0, 3], [1, 3], [2, 4], [3, 5]])
    const flat = sweepCopies(cards, roles, analysis, DEFAULT_DRAW, 3, 3) // card 3 is filler
    expect(flat.map((p) => p.deckSize)).toEqual([40, 40, 40, 40])
    expect(new Set(flat.map((p) => p.any)).size).toBe(1)
  })
  it('deck size: filler bounds the range, x is the size, the current size matches evaluate', () => {
    const pts = sweepDeckSize(cards, roles, analysis, DEFAULT_DRAW)
    expect(pts.map((p) => p.x)).toEqual(range(40, 60))
    expect(pts.every((p) => p.deckSize === p.x)).toBe(true)
    expect(pts[0]!.any).toBe(ev(cards).any.p)
    expect(pts[5]!.any).toBe(ev([card(1, 2), card(2, 1), ...fill(3, 42)]).any.p)
    expect(sweepDeckSize([card(1, 42), card(2, 1), ...fill(3, 2)], roles, analysis, DEFAULT_DRAW).map((p) => p.x)).toEqual(range(43, 60))
  })
  it('turn: 1..6 matching evaluate, dropping turns the deck cannot serve', () => {
    const pts = sweepTurn(cards, roles, analysis, DEFAULT_DRAW)
    expect(pts.map((p) => p.x)).toEqual([1, 2, 3, 4, 5, 6])
    expect(pts[2]!.any).toBe(ev(cards, { ...DEFAULT_DRAW, turn: 3 }).any.p)
    expect(sweepTurn([card(1, 2), ...fill(2, 10)], roles, analysis, { ...DEFAULT_DRAW, handSize: 10 }).map((p) => p.x)).toEqual([1, 2, 3])
  })
  it('copiesFor: the first x reaching the target, null when none does', () => {
    const pts: SweepPoint[] = [0.3, 0.6, 0.85, 0.9].map((any, i) => ({ x: i, deckSize: 40, hands: [any / 2], any }))
    expect(copiesFor(pts, 0.8, 'any')).toBe(2)
    expect(copiesFor(pts, 0.85, 'any')).toBe(2)
    expect(copiesFor(pts, 0.95, 'any')).toBeNull()
    expect(copiesFor(pts, 0.44, 0)).toBe(3)
    expect(copiesFor([], 0.5, 'any')).toBeNull()
  })
})
