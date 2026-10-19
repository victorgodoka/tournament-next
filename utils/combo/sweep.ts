import { referencedSubjects, satisfies } from './atoms'
import type { DeckCard } from './deck-cards'
import { evaluate } from './evaluate'
import type { Analysis, Draw, Roles } from './types'

/** One step of a sweep: `x` is copies, a deck size or a turn; `hands[i]` and `any` are probabilities. */
export type SweepPoint = { x: number; deckSize: number; hands: number[]; any: number }

/** The stand-in for filler cards (cards no rule names): never carries a role, never matches a card rule. */
export const FILLER_ID = -1
export const DECK_SIZE_RANGE = [40, 60] as const
export const TURNS = 6

const range = (lo: number, hi: number) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i)

/** The cards a rule can see (plus `keep`), and how many copies of everything else there are. */
const split = (cards: readonly DeckCard[], roles: Roles, analysis: Analysis, keep?: number) => {
  const subjects = referencedSubjects(analysis, null)
  const tagged: DeckCard[] = []
  let filler = 0
  for (const card of cards) {
    if (card.id === keep || subjects.some((s) => satisfies(card, roles, s))) tagged.push(card)
    else filler += card.copies
  }
  return { tagged, filler }
}

const withFiller = (tagged: readonly DeckCard[], filler: number): DeckCard[] =>
  filler > 0 ? [...tagged, { id: FILLER_ID, copies: filler, card: null, passcode: FILLER_ID }] : [...tagged]

const point = (x: number, cards: readonly DeckCard[], roles: Roles, analysis: Analysis, draw: Draw): SweepPoint | null => {
  const r = evaluate(cards, roles, analysis, draw)
  return 'error' in r ? null : { x, deckSize: r.deckSize, hands: r.hands.map((h) => h.odds.p), any: r.any.p }
}

const points = (xs: number[], at: (x: number) => SweepPoint | null): SweepPoint[] => xs.map(at).filter((p): p is SweepPoint => p !== null)

/**
 * Copies of one card from 0 to `limit` (or its current count, if higher). Each copy added takes a filler
 * card's place and each copy cut gives one back, so the deck size holds; it grows only once the filler is gone.
 */
export const sweepCopies = (cards: readonly DeckCard[], roles: Roles, analysis: Analysis, draw: Draw, cardId: number, limit: number): SweepPoint[] => {
  const target = cards.find((c) => c.id === cardId)
  if (!target) return []
  const { tagged, filler } = split(cards, roles, analysis, cardId)
  return points(range(0, Math.max(limit, target.copies)), (x) => {
    const swapped = tagged.map((c) => (c.id === cardId ? { ...c, copies: x } : c))
    return point(x, withFiller(swapped, Math.max(0, filler - (x - target.copies))), roles, analysis, draw)
  })
}

/** Main-deck sizes from `max(40, N − filler)` to `max(60, N)`: filler added or removed, the tagged cards untouched. */
export const sweepDeckSize = (cards: readonly DeckCard[], roles: Roles, analysis: Analysis, draw: Draw): SweepPoint[] => {
  const { tagged, filler } = split(cards, roles, analysis)
  const N = cards.reduce((sum, c) => sum + c.copies, 0)
  return points(range(Math.max(DECK_SIZE_RANGE[0], N - filler), Math.max(DECK_SIZE_RANGE[1], N)), (x) => point(x, withFiller(tagged, filler + (x - N)), roles, analysis, draw))
}

/** Turns 1..6 with the rest of the draw settings kept. */
export const sweepTurn = (cards: readonly DeckCard[], roles: Roles, analysis: Analysis, draw: Draw): SweepPoint[] =>
  points(range(1, TURNS), (x) => point(x, cards, roles, analysis, { ...draw, turn: x }))

/** The first `x` whose probability (hand `series`, or any hand) reaches `target` (0–1); `null` when none does. */
export const copiesFor = (points: readonly SweepPoint[], target: number, series: number | 'any'): number | null =>
  points.find((p) => (series === 'any' ? p.any : (p.hands[series] ?? 0)) >= target)?.x ?? null
