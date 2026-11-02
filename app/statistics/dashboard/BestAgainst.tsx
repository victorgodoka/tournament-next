import { bestAgainst, getDeck, plainDecks, type Meta, type Scope } from '@utils/statistics'
import { BestLine } from './WhatToPlay'

/** The contenders. Each is a request, and the API's limit is per IP, this server's here. */
const CONTENDERS = 8

/**
 * "Best against the 5 most played". The matchups aren't in `meta`: they come from the best tiered decks' own
 * answers, cached 5 minutes like it. Behind Suspense, so a cold scope doesn't hold the page; a refusal just drops the line.
 */
export const BestAgainst = async ({ meta, scope }: { meta: Meta; scope: Scope }) => {
  const decks = plainDecks(meta.decks)
  const contenders = decks.filter((d) => d.tier !== null).sort((a, b) => b.wrExpected - a.wrExpected).slice(0, CONTENDERS)
  const answers = await Promise.all(contenders.map((d) => getDeck(d.key, scope)))
  const best = bestAgainst(decks, answers.flatMap((a) => (a.ok ? a.data.matchups : [])))
  const deck = best && decks.find((d) => d.key === best.key)
  return deck ? <BestLine deck={deck} rate={best.wr} scope={scope} /> : null
}
