import type { Banlist } from '@utils/wiki'
import { canonicalId } from './model'
import { MAIN_MIN, MAX_COPIES, ZONE_MAX, type CardData, type CardMap, type Deck } from './types'

export type ProblemCode =
  | 'main-size'
  | 'extra-size'
  | 'side-size'
  | 'copies'
  | 'forbidden'
  | 'limited'
  | 'semi-limited'
  | 'points'
  | 'banned-type'
  | 'unreleased'
  | 'unknown-card'

export type Problem = { code: ProblemCode; cardId?: number; count?: number; limit?: number }

const COPY_CODE = [undefined, 'limited', 'semi-limited'] as const

/** Copies allowed on a normal list, or points on a Genesys one. Absent from the card's lists = unrestricted. */
export const cardStatus = (card: CardData, banlist: Banlist): { copies: 0 | 1 | 2 | 3 } | { points: number } => {
  const limitation = card.banlists?.find((b) => b.name === banlist.name)?.limitation
  if (banlist.pointCap !== null) return { points: limitation ?? 0 }
  return { copies: (limitation ?? MAX_COPIES) as 0 | 1 | 2 | 3 }
}

export const pointsUsed = (deck: Deck, cards: CardMap, banlist: Banlist): number =>
  [...deck.main, ...deck.extra, ...deck.side].reduce((sum, id) => {
    const card = cards.get(id)
    const status = card && cardStatus(card, banlist)
    return sum + (status && 'points' in status ? status.points : 0)
  }, 0)

const releaseRegion = (format: string): 'tcg' | 'ocg' | null =>
  format === 'tcg' || format === 'genesys' ? 'tcg' : format === 'ocg' || format === 'genesys_ocg' ? 'ocg' : null

export const validate = (deck: Deck, cards: CardMap, banlist: Banlist | null, today: string): Problem[] => {
  const problems: Problem[] = []

  const main = deck.main.length
  if (main < MAIN_MIN) problems.push({ code: 'main-size', count: main, limit: MAIN_MIN })
  else if (main > ZONE_MAX.main) problems.push({ code: 'main-size', count: main, limit: ZONE_MAX.main })
  if (deck.extra.length > ZONE_MAX.extra) problems.push({ code: 'extra-size', count: deck.extra.length, limit: ZONE_MAX.extra })
  if (deck.side.length > ZONE_MAX.side) problems.push({ code: 'side-size', count: deck.side.length, limit: ZONE_MAX.side })

  if (banlist && banlist.pointCap !== null) {
    const used = pointsUsed(deck, cards, banlist)
    if (used > banlist.pointCap) problems.push({ code: 'points', count: used, limit: banlist.pointCap })
  }

  // One entry per canonical card, in first-appearance order; counts span all zones.
  const seen = new Map<number, { card: CardData | undefined; count: number }>()
  for (const id of [...deck.main, ...deck.extra, ...deck.side]) {
    const card = cards.get(id)
    const key = card ? canonicalId(card) : id
    const entry = seen.get(key)
    if (entry) entry.count++
    else seen.set(key, { card, count: 1 })
  }

  const region = banlist && releaseRegion(banlist.format)
  for (const [cardId, { card, count }] of seen) {
    if (!card) problems.push({ code: 'unknown-card', cardId })

    const status = card && banlist ? cardStatus(card, banlist) : null
    const allowed: number = status && 'copies' in status ? status.copies : MAX_COPIES
    if (count > allowed) {
      if (allowed === 0) problems.push({ code: 'forbidden', cardId })
      else problems.push({ code: COPY_CODE[allowed] ?? 'copies', cardId, count, limit: allowed })
    }

    if (!card || !banlist) continue
    if (card.monsterTypes.some((t) => banlist.bannedTypes.includes(t))) problems.push({ code: 'banned-type', cardId })
    if (region) {
      const date = card.released[region]
      if (date === null || date > today) problems.push({ code: 'unreleased', cardId })
    }
  }

  return problems
}
