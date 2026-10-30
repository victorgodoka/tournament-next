import type { StatArchetype } from '@utils/statistics'

/**
 * Power tiers: the weekly tier list and its images, by results instead of popularity. The server's `tier`
 * (what `/statistics` shows) stays the popularity one.
 *
 * Decks are ranked by the Wilson lower bound of their win rate, so a small sample can't reach the top, and a
 * tier is how far a deck sits below the best one. Wilson only corrects for sample size: a deck piloted by two
 * players reads as strong, which is what the floors are for.
 */
export const POWER_BANDS = [0.01, 0.03, 0.06, 0.09] as const
export const POWER_MIN_SHARE = 0.005
export const POWER_MIN_PLAYERS = 10

const score = (deck: StatArchetype) => deck.wilsonLower ?? 0

/**
 * The card that stands for each deck, by archetype key. A hybrid's face is often its parent's, and now they sit
 * side by side: the second one takes its next most used card, so no two decks on a board look the same.
 */
export const deckFaces = (decks: StatArchetype[]) => {
  const taken = new Set<number>()
  return new Map(
    decks.flatMap((deck) => {
      const face = [deck.face, ...deck.cards].find((card) => card && !taken.has(card.id))
      if (!face) return []
      taken.add(face.id)
      return [[deck.archetype.join('-'), face] as const]
    }),
  )
}

/** Every deck past the floors, strongest first, with `tier` replaced: 1–4, or `null` below the last band. */
export const powerRanked = (decks: StatArchetype[]): StatArchetype[] => {
  const listed = decks
    .filter((deck) => deck.wilsonLower != null && deck.metaShare >= POWER_MIN_SHARE && deck.players >= POWER_MIN_PLAYERS)
    .sort((a, b) => score(b) - score(a))
  const best = listed[0]?.wilsonLower ?? 0
  return listed.map((deck) => {
    // The API rounds to 4 places: rounded here too, or 0.548 − 0.538 lands just past the band.
    const gap = Math.round((best - score(deck)) * 10_000) / 10_000
    const band = POWER_BANDS.findIndex((limit) => gap <= limit)
    return { ...deck, tier: band === -1 ? null : ((band + 1) as 1 | 2 | 3 | 4) }
  })
}
