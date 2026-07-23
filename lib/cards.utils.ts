import { Card } from "./cards.types"

// Canonical card-image bases — app modules re-export from here, never the
// other way around (lib must not depend on app).
export const CARD_ART_BASE = 'https://ygopro.online/assets/card-images/common'
export const CARD_ART_BASE_FULL = 'https://ygopro.online/assets/card-arts'

export const EXTRA_TYPES = ['fusion', 'synchro', 'xyz', 'link']

export type CardCategory = 'monster' | 'spell' | 'trap'

/** A single card entry in a deck, collapsed to one row with its copy count. */
export interface DeckCardGroup {
  id: number
  card: Card | null
  count: number
}

/**
 * Extra-deck monster subtype (fusion/synchro/xyz/link), or null for main-deck
 * cards. The API reports these in `type_tags`; `type_primary` is only ever the
 * broad Monster/Spell/Trap bucket, so we read the tags first.
 */
export const extraDeckType = (card: Card | null | undefined): string | null => {
  const tags = (card?.type_tags ?? []).map((tag) => tag.toLowerCase())
  const fromTags = EXTRA_TYPES.find((type) => tags.includes(type))
  if (fromTags) return fromTags

  const primary = card?.type_primary?.toLowerCase() ?? ''
  return EXTRA_TYPES.includes(primary) ? primary : null
}

export const isExtra = (card: Card) => extraDeckType(card) !== null

/** Broad grouping used for ordering and colour-coding a main/side deck. */
export const cardCategory = (card: Card | null | undefined): CardCategory => {
  const type = card?.type_primary?.toLowerCase() ?? ''
  if (type === 'spell') return 'spell'
  if (type === 'trap') return 'trap'
  return 'monster'
}

/** Display name with the same EN → PT → id fallback used across the app,
 * needed now that `name_en`/`name_pt` can come back null from the API. */
export const cardDisplayName = (card: Card): string =>
  card.name_en || card.name_pt || `Card #${card.id}`

/** Full-art image URL for a card passcode. */
export const cardImageUrl = (id: number, full?: boolean) => `${full ? CARD_ART_BASE_FULL : CARD_ART_BASE}/${id}.jpg`

/** Index card data by passcode (and canonical id) for O(1) lookup by deck ids. */
export const buildCardLookup = (cards: Card[]): Map<number, Card> => {
  const lookup = new Map<number, Card>()

  for (const card of cards) {
    lookup.set(card.id, card)
    if (card.canonicalId !== undefined && !lookup.has(card.canonicalId)) {
      lookup.set(card.canonicalId, card)
    }
  }

  return lookup
}

/**
 * Collapse a flat list of card ids (with duplicates) into one entry per card,
 * carrying the copy count and preserving first-seen order.
 */
export const groupDeckCards = (
  ids: number[],
  lookup: Map<number, Card>,
): DeckCardGroup[] => {
  const order: number[] = []
  const counts = new Map<number, number>()

  for (const id of ids) {
    if (!counts.has(id)) order.push(id)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  return order.map((id) => ({
    id,
    card: lookup.get(id) ?? null,
    count: counts.get(id) ?? 0,
  }))
}
