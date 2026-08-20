import type { Card } from '@lib/cards.types'

/** Competitive formats the editor can validate a deck against. Each maps to a
 * region on the cards API and a key in `Card.banlist_data`. */
export type DeckFormat = 'tcg' | 'ocg' | 'genesys'

/** The three deck sections a card can live in. */
export type DeckZone = 'main' | 'extra' | 'side'

/** Normalised banlist status, independent of the API's exact casing. */
export type BanStatus = 'forbidden' | 'limited' | 'semi-limited' | 'unlimited'

/** Card ids per zone plus a cache of the full card data keyed by id, so
 * validation and rendering never need a second lookup. Serialisable as-is for
 * localStorage drafts and the `/convert` body. */
export interface EditorState {
  format: DeckFormat
  main: number[]
  extra: number[]
  side: number[]
  cards: Record<number, Card>
  /** Cosmetic alt-art choice per card id (a value from that card's `alias`
   * list) — purely display, doesn't change which id is actually in the deck. */
  artOverrides: Record<number, number>
}

/** The `{ main, side, extra }` body POSTed to `/convert?full=y`. */
export interface ConvertBody {
  main: number[]
  extra: number[]
  side: number[]
}

/** A single filter control's value. Every field is optional; only defined ones
 * reach the cards API. */
export interface CardFilters {
  name?: string
  desc?: string
  type?: 'Monster' | 'Spell' | 'Trap'
  attribute?: string
  race?: string
  atkMin?: number
  atkMax?: number
  defMin?: number
  defMax?: number
  levelMin?: number
  levelMax?: number
  pScale?: number
  setcode?: string
  /** Client-side refine over loaded results: monster/spell/trap subtype tag. */
  subtype?: string
  /** Client-side refine: substring matched against every tag array on a card. */
  tag?: string
}

/** One detected archetype in the converted deck. */
export interface OmegaArchetype {
  name: string
  count: number
  percentage: number
}

/**
 * Response of `POST {API.MAIN}/convert?full=y`. The upstream shape is only
 * loosely pinned, so every field is optional and mapped defensively into the
 * `ConvertedDeck` the shared deck-list/export components already understand.
 */
export interface OmegaDeckResponse {
  codes?: { omegaCode?: string; ydkeUrl?: string }
  archetypeData?: {
    primaryArchetype?: string | null
    primaryArchetypeWeighted?: string | null
    primaryArchetypes?: string[]
    archetypesData?: OmegaArchetype[]
  }
  fullDeck?: {
    main?: number[]
    extra?: number[]
    side?: number[]
  }
  uniqueCardsData?: Card[]
  category?: string
}
