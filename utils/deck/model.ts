import { MAX_COPIES, ZONE_MAX, type CardData, type CardMap, type Deck, type Zone } from './types'

export type AddResult = { deck: Deck; rejected: null | 'copies' | 'full' | 'zone' }

const EXTRA_TYPES = ['fusion', 'synchro', 'xyz', 'link']
export type CardFrame = 'normal' | 'effect' | 'ritual' | 'fusion' | 'synchro' | 'xyz' | 'link' | 'spell' | 'trap'

/** Game order: monster frames, then spells, then traps. */
const FRAMES: CardFrame[] = ['normal', 'effect', 'ritual', 'fusion', 'synchro', 'xyz', 'link', 'spell', 'trap']
const SPECIAL_FRAMES = ['ritual', 'fusion', 'synchro', 'xyz', 'link'] as const

/** A monster's frame is its first special frame, else Normal or Effect; Pendulum follows the same rule. */
export const frameOf = (card: Pick<CardData, 'kind' | 'monsterTypes'>): CardFrame => {
  if (card.kind !== 'monster') return card.kind
  return SPECIAL_FRAMES.find((t) => card.monsterTypes.includes(t)) ?? (card.monsterTypes.includes('normal') ? 'normal' : 'effect')
}

export const isExtraDeckCard = (card: CardData): boolean => card.monsterTypes.some((t) => EXTRA_TYPES.includes(t))

export const canonicalId = (card: CardData): number => card.alias ?? card.ruleId ?? card.idOriginal ?? card.id

/** Banlist formats whose Omega code carries a double-script card's TCG passcode; the rest carry the OCG one. */
const TCG_FORMATS = ['tcg', 'wcs', 'genesys']
export const usesTcgPasscodes = (banlistFormat: string): boolean => TCG_FORMATS.includes(banlistFormat)

/**
 * `id` as the double-script print for the format: TCG passcode when `tcg`, OCG otherwise. `card` is
 * what the cache holds for `id`, either print. Every other passcode, alternate artworks included,
 * comes back unchanged.
 */
const passcodeIn = (id: number, card: CardData | undefined, tcg: boolean): number => {
  if (!card?.idTcg) return id
  if (tcg) return id === card.idOriginal ? card.idTcg : id
  return id === card.idTcg ? card.idOriginal : id
}

export const deckIn = (deck: Deck, cards: CardMap, tcg: boolean): Deck => {
  const zone = (ids: readonly number[]) => ids.map((id) => passcodeIn(id, cards.get(id), tcg))
  return { main: zone(deck.main), extra: zone(deck.extra), side: zone(deck.side) }
}

/** The card as the print the deck stores for the format (see `passcodeIn`). */
export const inFormat = (card: CardData, tcg: boolean): CardData => {
  const id = passcodeIn(card.id, card, tcg)
  return id === card.id ? card : { ...card, id }
}

/**
 * The card as one of its artworks. The cache keys an alternate artwork's passcode to the original
 * card, so adding that object would add the original's passcode; this one adds `passcode` and still
 * counts as the original.
 */
export const printOf = (card: CardData, passcode: number): CardData =>
  passcode === card.id ? card : { ...card, id: passcode, imageId: passcode, alias: canonicalId(card) }

/**
 * The passcode whose image shows `id`. `card` is what the cache holds for it: a pre-errata version and a
 * double-script TCG print take the card's `imageId`, an alternate artwork keeps its own. No card yet: `id`.
 */
export const imageOf = (id: number, card: CardData | undefined): number =>
  card && (id === card.id || id === card.idTcg) ? (card.imageId ?? id) : id

/** Copies per canonical card across the deck; a passcode not in `cards` counts as itself. One pass for a whole pool page. */
export const copyCounts = (deck: Deck, cards: CardMap): Map<number, number> => {
  const counts = new Map<number, number>()
  for (const id of [...deck.main, ...deck.extra, ...deck.side]) {
    const c = cards.get(id)
    const key = c ? canonicalId(c) : id
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export const copiesOf = (deck: Deck, card: CardData, cards: CardMap): number => copyCounts(deck, cards).get(canonicalId(card)) ?? 0

export const addCard = (deck: Deck, card: CardData, cards: CardMap, zone?: Zone): AddResult => {
  const extra = isExtraDeckCard(card)
  const to = zone ?? (extra ? 'extra' : 'main')
  if ((to === 'extra') !== extra && to !== 'side') return { deck, rejected: 'zone' }
  if (copiesOf(deck, card, cards) >= MAX_COPIES) return { deck, rejected: 'copies' }
  if (deck[to].length >= ZONE_MAX[to]) return { deck, rejected: 'full' }
  return { deck: { ...deck, [to]: [...deck[to], card.id] }, rejected: null }
}

export const removeCard = (deck: Deck, zone: Zone, id: number): Deck => {
  const at = deck[zone].lastIndexOf(id)
  if (at < 0) return deck
  return { ...deck, [zone]: deck[zone].filter((_, i) => i !== at) }
}

export const moveCard = (deck: Deck, from: Zone, id: number, to: Zone, cards: CardMap): AddResult => {
  if (from === to || !deck[from].includes(id)) return { deck, rejected: null }
  const card = cards.get(id)
  // An unknown card (cache lag) can only be placed via Side, which accepts anything; main<->extra is a no-op.
  if (!card && from !== 'side' && to !== 'side') return { deck, rejected: null }
  if (card && (to === 'extra') !== isExtraDeckCard(card) && to !== 'side') return { deck, rejected: 'zone' }
  // A move never changes the total copy count, so no copies check (imported decks may exceed 3).
  if (deck[to].length >= ZONE_MAX[to]) return { deck, rejected: 'full' }
  const removed = removeCard(deck, from, id)
  return { deck: { ...removed, [to]: [...removed[to], id] }, rejected: null }
}

export const reorder = (deck: Deck, zone: Zone, from: number, to: number): Deck => {
  const list = deck[zone]
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return deck
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return { ...deck, [zone]: next }
}

const groupRank = (card: CardData): number => FRAMES.indexOf(frameOf(card))

export const sortZone = (ids: readonly number[], cards: CardMap): number[] => {
  const known = ids.filter((id) => cards.has(id))
  const unknown = ids.filter((id) => !cards.has(id))
  known.sort((a, b) => {
    const x = cards.get(a)!
    const y = cards.get(b)!
    return (
      groupRank(x) - groupRank(y) ||
      (y.level ?? 0) - (x.level ?? 0) ||
      x.name.localeCompare(y.name) ||
      a - b
    )
  })
  return [...known, ...unknown]
}

export const splitExtra = (ids: readonly number[], cards: CardMap): { main: number[]; extra: number[] } => {
  const isExtra = (id: number) => {
    const c = cards.get(id)
    return !!c && isExtraDeckCard(c)
  }
  return { main: ids.filter((id) => !isExtra(id)), extra: ids.filter(isExtra) }
}
