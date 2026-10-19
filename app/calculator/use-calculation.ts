import { useMemo } from 'react'
import { subjectCopies } from '@utils/combo/atoms'
import { canonicalOf, distinctCards, type DeckCard } from '@utils/combo/deck-cards'
import { drawCount, evaluate, type Evaluation, type EvaluateError } from '@utils/combo/evaluate'
import { distribution, type Odds } from '@utils/combo/hypergeometric'
import { palette } from '@utils/combo/roles'
import type { Analysis, Build, Draw, Roles, Subject } from '@utils/combo/types'
import type { CardMap, Deck } from '@utils/deck/types'

export type CalculationView = {
  /** The build's main deck plus the loaded deck's cards taken to 0 copies, so their rows stay. */
  rows: DeckCard[]
  result: Evaluation | EvaluateError
  palette: string[]
  focusDist: Odds[] | null
  focusCopies: number
}

const compute = (build: Build, original: Deck, cards: CardMap, analysis: Analysis, draw: Draw, focus: Subject | null): CalculationView => {
  const rows = distinctCards([...build.deck.main, ...original.main], cards)
  const counts = new Map<number, number>()
  for (const passcode of build.deck.main) {
    const id = canonicalOf(passcode, cards)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  for (const row of rows) row.copies = counts.get(row.id) ?? 0
  const result = evaluate(rows, build.roles, analysis, draw)
  const deckSize = build.deck.main.length
  const focusCopies = focus ? subjectCopies(rows, build.roles, focus) : 0
  const focusDist = focus && !('error' in result) ? distribution(deckSize, focusCopies, drawCount(draw)) : null
  return { rows, result, palette: palette(build.roles), focusDist, focusCopies }
}

type Entry = { inputs: readonly unknown[]; view: CalculationView }

/**
 * Views by the build's deck and roles, which every edit replaces rather than mutates; the other inputs are
 * compared on lookup. A rename, or an edit to another build, then costs nothing: with several builds and a
 * sweep each exact evaluation runs up to twenty times, so recomputing all of them on every keystroke would stall typing.
 */
const cache = new WeakMap<Deck, WeakMap<Roles, Entry>>()

const cached = (build: Build, original: Deck, cards: CardMap, analysis: Analysis, draw: Draw, focus: Subject | null): CalculationView => {
  const inputs = [original, cards, analysis, draw, focus]
  let byRoles = cache.get(build.deck)
  if (!byRoles) cache.set(build.deck, (byRoles = new WeakMap()))
  const hit = byRoles.get(build.roles)
  if (hit && hit.inputs.every((v, i) => Object.is(v, inputs[i]))) return hit.view
  const view = compute(build, original, cards, analysis, draw, focus)
  byRoles.set(build.roles, { inputs, view })
  return view
}

/** One view per build, in order: the analysis and draw are shared, each build brings its own deck and roles. */
export const useCalculations = (builds: Build[], originals: Deck[], cards: CardMap, analysis: Analysis, draw: Draw, focus: Subject | null): CalculationView[] =>
  useMemo(() => builds.map((build, i) => cached(build, originals[i] ?? build.deck, cards, analysis, draw, focus)), [builds, originals, cards, analysis, draw, focus])
