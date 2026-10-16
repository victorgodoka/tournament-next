import { MAX_COPIES, ZONE_MAX, type CardData, type CardMap, type Deck, type Zone } from './types'

export type AddResult = { deck: Deck; rejected: null | 'copies' | 'full' | 'zone' }

const EXTRA_TYPES = ['fusion', 'synchro', 'xyz', 'link']
const FRAMES = ['normal', 'effect', 'ritual', 'fusion', 'synchro', 'xyz', 'link']

export const isExtraDeckCard = (card: CardData): boolean => card.monsterTypes.some((t) => EXTRA_TYPES.includes(t))

export const canonicalId = (card: CardData): number => card.alias ?? card.ruleId ?? card.id

export const copiesOf = (deck: Deck, card: CardData, cards: CardMap): number => {
  const target = canonicalId(card)
  return [...deck.main, ...deck.extra, ...deck.side].filter((id) => {
    const c = cards.get(id)
    return (c ? canonicalId(c) : id) === target
  }).length
}

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
  const card = cards.get(id)
  if (!card || !deck[from].includes(id)) return { deck, rejected: card ? null : 'zone' }
  const res = addCard(removeCard(deck, from, id), card, cards, to)
  return res.rejected ? { deck, rejected: res.rejected } : res
}

export const reorder = (deck: Deck, zone: Zone, from: number, to: number): Deck => {
  const list = deck[zone]
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return deck
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return { ...deck, [zone]: next }
}

/** Monster frame rank; Pendulum follows the same rule as any other monster. */
const frameRank = (card: CardData): number => {
  const frame = ['ritual', 'fusion', 'synchro', 'xyz', 'link'].find((t) => card.monsterTypes.includes(t))
  return FRAMES.indexOf(frame ?? (card.monsterTypes.includes('normal') ? 'normal' : 'effect'))
}

const groupRank = (card: CardData): number => (card.kind === 'monster' ? frameRank(card) : card.kind === 'spell' ? 10 : 11)

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
