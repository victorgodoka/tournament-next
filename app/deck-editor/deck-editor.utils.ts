import type { Card } from '@lib/cards.types'
import { isExtra } from '@lib/cards.utils'
import {
  BAN_LABEL,
  COPY_LIMIT,
  FORMATS,
  GENESYS_POINT_BUDGET,
  ZONE_LIMITS,
} from './deck-editor.const'
import type {
  BanStatus,
  ConvertBody,
  DeckFormat,
  DeckZone,
  EditorState,
} from './deck-editor.types'

/** Map the API's free-form status string to a normalised status. Order matters:
 * "semi-limited" also contains "limit", so it must be tested first. */
export function normalizeBanStatus(status?: string): BanStatus {
  const s = (status ?? '').toLowerCase()
  if (s.includes('forbid') || s.includes('ban')) return 'forbidden'
  if (s.includes('semi')) return 'semi-limited'
  if (s.includes('limit')) return 'limited'
  return 'unlimited'
}

/** Banlist status of a card in the given format (unlimited when unlisted). */
export function banStatus(card: Card | undefined, format: DeckFormat): BanStatus {
  return normalizeBanStatus(card?.banlist_data?.[format]?.status)
}

/** Max total copies of a card allowed across the whole deck for the format. */
export function copyLimit(card: Card | undefined, format: DeckFormat): number {
  return COPY_LIMIT[banStatus(card, format)]
}

/** Genesys point cost of a single copy (0 when the card is uncosted). */
export function genesysCost(card: Card | undefined): number {
  return card?.banlist_data?.genesys?.value ?? 0
}

/** Where a card belongs by default: Extra for fusion/synchro/xyz/link, else Main. */
export function defaultZone(card: Card): Extract<DeckZone, 'main' | 'extra'> {
  return isExtra(card) ? 'extra' : 'main'
}

export function formatLabel(format: DeckFormat): string {
  return FORMATS.find((f) => f.value === format)?.label ?? format
}

/** Cards sharing a `rule` id (e.g. errata'd reprints) share one 3-copy limit
 * even though each id still lists as its own row — so the limit check groups
 * by the shared id while every other lookup stays keyed by the exact id.
 * `card` is an optional override for ids not yet in `state.cards` (a search
 * result the player hasn't added yet still needs its `rule` read from the
 * card object itself, not the deck's cache). */
function limitGroupKey(state: EditorState, id: number, card?: Card): number {
  return (card ?? state.cards[id])?.rule ?? id
}

/** Total copies across every zone of every id that shares `id`'s copy limit. */
export function totalCopies(state: EditorState, id: number, card?: Card): number {
  const key = limitGroupKey(state, id, card)
  const count = (ids: number[]) => ids.filter((x) => limitGroupKey(state, x) === key).length
  return count(state.main) + count(state.extra) + count(state.side)
}

/** Copies of `id` in a single zone. */
export function zoneCopies(ids: number[], id: number): number {
  return ids.filter((x) => x === id).length
}

/** Sum of Genesys point costs over every card instance in the deck. */
export function genesysTotal(state: EditorState): number {
  const all = [...state.main, ...state.extra, ...state.side]
  return all.reduce((sum, id) => sum + genesysCost(state.cards[id]), 0)
}

const cardName = (state: EditorState, id: number) =>
  state.cards[id]?.name_en ?? `Card #${id}`

export interface DeckValidation {
  issues: string[]
  counts: Record<DeckZone, number>
  /** Genesys only — running point total against the budget. */
  points: number
  isLegal: boolean
}

/**
 * Collect every rule violation for the current deck: zone-size bounds, per-card
 * copy limits (which fold Forbidden in as a 0-copy limit), and the Genesys point
 * budget. An empty `issues` list means the deck is tournament-legal.
 */
export function validateDeck(state: EditorState): DeckValidation {
  const counts: Record<DeckZone, number> = {
    main: state.main.length,
    extra: state.extra.length,
    side: state.side.length,
  }
  const issues: string[] = []

  if (counts.main < ZONE_LIMITS.main.min)
    issues.push(`Main Deck must have at least ${ZONE_LIMITS.main.min} cards (currently ${counts.main})`)
  if (counts.main > ZONE_LIMITS.main.max)
    issues.push(`Main Deck must have at most ${ZONE_LIMITS.main.max} cards (currently ${counts.main})`)
  if (counts.extra > ZONE_LIMITS.extra.max)
    issues.push(`Extra Deck must have at most ${ZONE_LIMITS.extra.max} cards (currently ${counts.extra})`)
  if (counts.side > ZONE_LIMITS.side.max)
    issues.push(`Side Deck must have at most ${ZONE_LIMITS.side.max} cards (currently ${counts.side})`)

  // Per-card copy limits, checked once per unique id.
  const seen = new Set<number>()
  for (const id of [...state.main, ...state.extra, ...state.side]) {
    if (seen.has(id)) continue
    seen.add(id)
    const card = state.cards[id]
    const total = totalCopies(state, id)
    const limit = copyLimit(card, state.format)
    if (total > limit) {
      const status = banStatus(card, state.format)
      issues.push(
        limit === 0
          ? `${cardName(state, id)} is Forbidden in ${formatLabel(state.format)}`
          : `${cardName(state, id)} is ${BAN_LABEL[status]} — max ${limit} cop${limit === 1 ? 'y' : 'ies'} (currently ${total})`,
      )
    }
  }

  const points = genesysTotal(state)
  if (state.format === 'genesys' && points > GENESYS_POINT_BUDGET)
    issues.push(`Deck exceeds the ${GENESYS_POINT_BUDGET}-point Genesys budget (currently ${points})`)

  return { issues, counts, points, isLegal: issues.length === 0 }
}

/** Can another copy of `card` be added to `zone` without breaking a rule?
 * Used to disable "add" affordances before an invalid state is ever created. */
export function canAdd(
  state: EditorState,
  card: Card,
  zone: DeckZone,
): boolean {
  if (state[zone].length >= ZONE_LIMITS[zone].max) return false
  if (totalCopies(state, card.id, card) >= copyLimit(card, state.format)) return false
  return true
}

/** The `{ main, extra, side }` body for `POST /convert?full=y`. */
export function toConvertBody(state: EditorState): ConvertBody {
  return { main: state.main, extra: state.extra, side: state.side }
}

export const isDeckEmpty = (state: EditorState): boolean =>
  state.main.length === 0 && state.extra.length === 0 && state.side.length === 0
