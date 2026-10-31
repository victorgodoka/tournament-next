import type { StatArchetype } from '@utils/statistics'

/**
 * The server's rule for `tier` (`metaTiers` in omega-server-v3), kept here for the tier list's own text and floors.
 *
 * Decks are ranked by the Wilson lower bound of their win rate, so a small sample can't reach the top, and a
 * tier is how far a deck sits below the best one. Wilson only corrects for sample size: a deck piloted by two
 * players reads as strong, which is what the floors are for.
 *
 * Tier 1 holds the two best decks at most: anyone else inside the first band is Tier 1.5.
 */
export const POWER_BANDS = [0.01, 0.03, 0.06, 0.09] as const
export const POWER_T1_CAP = 2
export const POWER_MIN_SHARE = 0.005
export const POWER_MIN_PLAYERS = 10

const score = (deck: StatArchetype) => deck.wilsonLower ?? 0

/**
 * The card that stands for each deck, by archetype key. A hybrid's face is often its parent's, and now they sit
 * side by side: the second one takes its next most used card, so no two decks on a board look the same.
 */
export const deckFaces = (decks: Pick<StatArchetype, 'archetype' | 'face' | 'cards'>[]) => {
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

/** Every deck past the floors, strongest first. A `null` tier here means below the last band. */
export const powerRanked = (decks: StatArchetype[]) =>
  decks
    .filter((deck) => deck.wilsonLower != null && deck.metaShare >= POWER_MIN_SHARE && deck.players >= POWER_MIN_PLAYERS)
    .sort((a, b) => score(b) - score(a))
