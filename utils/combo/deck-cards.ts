import { canonicalId } from '@utils/deck/model'
import { cardStatus } from '@utils/deck/rules'
import { MAX_COPIES, type CardData, type CardMap } from '@utils/deck/types'
import type { Banlist } from '@utils/wiki'

/** One distinct card of a deck. `id` is canonical; `passcode` the first print seen (art, adding copies). */
export type DeckCard = { id: number; copies: number; card: CardData | null; passcode: number }

/** A passcode the cache lacks is its own card. */
export const canonicalOf = (id: number, cards: CardMap): number => {
  const card = cards.get(id)
  return card ? canonicalId(card) : id
}

/** Distinct cards in first-appearance order; alternate artworks and double-script prints merge. */
export const distinctCards = (ids: readonly number[], cards: CardMap): DeckCard[] => {
  const rows = new Map<number, DeckCard>()
  for (const passcode of ids) {
    const id = canonicalOf(passcode, cards)
    const row = rows.get(id)
    if (row) row.copies++
    else rows.set(id, { id, copies: 1, card: cards.get(passcode) ?? null, passcode })
  }
  return [...rows.values()]
}

/** `main` with `copies` prints of `canonical`: the first ones stay in place, extras go, missing ones are `passcode` appended. */
export const withCopies = (main: readonly number[], canonical: number, copies: number, cards: CardMap, passcode: number): number[] => {
  let kept = 0
  const out = main.filter((id) => canonicalOf(id, cards) !== canonical || kept++ < copies)
  for (let i = kept; i < copies; i++) out.push(passcode)
  return out
}

/** Copies the format allows: the list's limit when it gives copies, else 3 (no list, Genesys points, unknown card). */
export const copyLimit = (card: CardData | null, banlist: Banlist | null): number => {
  if (!card || !banlist) return MAX_COPIES
  const status = cardStatus(card, banlist)
  return 'copies' in status ? status.copies : MAX_COPIES
}
