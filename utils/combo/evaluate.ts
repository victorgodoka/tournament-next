import { atomize, referencedSubjects } from './atoms'
import type { DeckCard } from './deck-cards'
import { choose, odds, type Odds } from './hypergeometric'
import { subjectKey, type Analysis, type Draw, type Hand, type Roles } from './types'

/** Cards seen: the opening hand (5 first, 6 second, or the override), extra draws, one draw per later turn. */
export const drawCount = (draw: Draw): number => (draw.handSize ?? (draw.going === 'first' ? 5 : 6)) + draw.extraDraws + (draw.turn - 1)

/** Measured on the main thread: ~650 ms at 650k compositions, 4.4 s at 4.5M. Half a million keeps every keystroke under a second. */
export const MAX_COMPOSITIONS = 500_000

/** Upper bound on the compositions of `n` cards over `atomCount` atoms plus "other": C(n + m − 1, m − 1). */
export const estimateCompositions = (atomCount: number, n: number): bigint => {
  const m = atomCount + 1
  return m === 1 ? 1n : choose(n + m - 1, m - 1)
}

export type HandResult = { name: string; odds: Odds }
export type Evaluation = { hands: HandResult[]; any: Odds; draw: number; deckSize: number }
export type EvaluateError = { error: 'tooFewCards' | 'tooComplex' }

/**
 * Exact odds of each hand and of any hand: every way to split the `n` cards seen among the atoms is
 * weighed by its combinations and checked against the rules, so overlapping roles and alternative hands
 * are never counted twice.
 */
export const evaluate = (cards: readonly DeckCard[], roles: Roles, analysis: Analysis, draw: Draw): Evaluation | EvaluateError => {
  const n = drawCount(draw)
  const N = cards.reduce((sum, card) => sum + card.copies, 0)
  if (n > N) return { error: 'tooFewCards' }
  const { atoms, other } = atomize(cards, roles, referencedSubjects(analysis, null))
  // ponytail: full enumeration; DP over capped per-subject counts if players hit the ceiling
  if (estimateCompositions(atoms.length, n) > BigInt(MAX_COMPOSITIONS)) return { error: 'tooComplex' }

  /** Copies in the atoms after `i`, so a branch that can't reach `n` is never entered. */
  const after = atoms.map((_, i) => atoms.slice(i + 1).reduce((sum, a) => sum + a.size, 0))
  const favorable = analysis.hands.map(() => 0n)
  let any = 0n
  const counts = new Map<string, number>()
  // A hand with no rules is unfinished, not "always playable": it never passes.
  const passes = (hand: Hand) =>
    hand.rules.length > 0 &&
    hand.rules.every((rule) => {
      const count = counts.get(subjectKey(rule.subject)) ?? 0
      return count >= rule.min && (rule.max === null || count <= rule.max)
    })

  const recurse = (i: number, remaining: number, weight: bigint) => {
    if (i === atoms.length) {
      if (remaining > other) return
      const w = weight * choose(other, remaining)
      let hit = false
      analysis.hands.forEach((hand, index) => {
        if (!passes(hand)) return
        favorable[index]! += w
        hit = true
      })
      if (hit) any += w
      return
    }
    const atom = atoms[i]!
    const lo = Math.max(0, remaining - after[i]! - other)
    const hi = Math.min(atom.size, remaining)
    for (let k = lo; k <= hi; k++) {
      for (const key of atom.signature) counts.set(key, (counts.get(key) ?? 0) + k)
      recurse(i + 1, remaining - k, weight * choose(atom.size, k))
      for (const key of atom.signature) counts.set(key, counts.get(key)! - k)
    }
  }
  recurse(0, n, 1n)

  const total = choose(N, n)
  return {
    hands: analysis.hands.map((hand, i) => ({ name: hand.name, odds: odds(favorable[i]!, total) })),
    any: odds(any, total),
    draw: n,
    deckSize: N,
  }
}
