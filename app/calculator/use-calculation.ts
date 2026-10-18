import { useMemo } from 'react'
import { subjectCopies } from '@utils/combo/atoms'
import { canonicalOf, distinctCards, type DeckCard } from '@utils/combo/deck-cards'
import { drawCount, evaluate, type Evaluation, type EvaluateError } from '@utils/combo/evaluate'
import { distribution, type Odds } from '@utils/combo/hypergeometric'
import { palette } from '@utils/combo/roles'
import type { Analysis, Build, Draw, Subject } from '@utils/combo/types'
import type { CardMap, Deck } from '@utils/deck/types'

export type CalculationView = {
  /** The build's main deck plus the loaded deck's cards taken to 0 copies, so their rows stay. */
  rows: DeckCard[]
  result: Evaluation | EvaluateError
  palette: string[]
  focusDist: Odds[] | null
  focusCopies: number
}

export const useCalculation = (build: Build, original: Deck, cards: CardMap, analysis: Analysis, draw: Draw, focus: Subject | null): CalculationView =>
  useMemo(() => {
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
  }, [build, original, cards, analysis, draw, focus])
