import { CARDS, LISTS } from './banlist-data'

/** F Forbidden, L Limited, S Semi-Limited, U Unlimited (off the list), N never on a list before. */
export type BanStatus = 'F' | 'L' | 'S' | 'U' | 'N'
export type Restricted = 'F' | 'L' | 'S'

export type BanChange = { card: number; from: BanStatus; to: BanStatus }

export type Banlist = {
  index: number
  /** `YYYY-MM-DD` it took (or takes) effect. */
  date: string
  /** Last day in force; `null` while no later list exists. */
  end: string | null
  changes: BanChange[]
  /** Who is on it, by status, sorted by name. */
  cards: Record<Restricted, number[]>
  total: number
}

export const RESTRICTED: Restricted[] = ['F', 'L', 'S']

/** Swatch fill and label color per status. */
export const STATUS_TONE: Record<BanStatus, { fill: string; text: string }> = {
  F: { fill: 'bg-crimson', text: 'text-crimson-lift' },
  L: { fill: 'bg-tier-bronze', text: 'text-tier-bronze' },
  S: { fill: 'bg-gold', text: 'text-gold' },
  U: { fill: 'bg-win', text: 'text-win' },
  N: { fill: 'bg-azure-lift', text: 'text-azure-lift' },
}

export const BANLIST_CARDS = CARDS.split('|')

export const cardName = (card: number) => BANLIST_CARDS[card] ?? ''

/** Card status per list, `BANLIST_HISTORY[card][list]`: `U` when not on it. */
export const BANLIST_HISTORY: BanStatus[][] = BANLIST_CARDS.map(() => [])

export const statusOn = (card: number, list: number): BanStatus => BANLIST_HISTORY[card]?.[list] ?? 'U'

const byName = (a: number, b: number) => cardName(a).localeCompare(cardName(b))

export const BANLISTS: Banlist[] = (() => {
  const on = new Map<number, Restricted>()
  return LISTS.split(';').map((row, index) => {
    const [date = '', end = '', codes = ''] = row.split(',')
    const changes = codes.split(' ').map((code) => {
      const [, card, from, to] = /^(\d+)([FLSUN])([FLSUN])$/.exec(code)!
      return { card: Number(card), from: from as BanStatus, to: to as BanStatus }
    })
    for (const { card, to } of changes) {
      if (to === 'U' || to === 'N') on.delete(card)
      else on.set(card, to)
    }
    const cards: Record<Restricted, number[]> = { F: [], L: [], S: [] }
    for (const [card, status] of on) cards[status].push(card)
    for (const status of RESTRICTED) cards[status].sort(byName)
    BANLIST_HISTORY.forEach((row, card) => (row[index] = on.get(card) ?? 'U'))
    return { index, date, end: end || null, changes, cards, total: on.size }
  })
})()

export const FIRST_BANLIST = BANLISTS[0]!
export const LATEST_BANLIST = BANLISTS.at(-1)!
export const BANLIST_MAX = Math.max(...BANLISTS.map((list) => list.total))
export const BANLIST_CHANGES = BANLISTS.reduce((sum, list) => sum + list.changes.length, 0)

/** The list in force on `today` (`YYYY-MM-DD`); a later one is announced. */
export const currentBanlist = (today = new Date().toISOString().slice(0, 10)) =>
  BANLISTS.findLast((list) => list.date <= today) ?? FIRST_BANLIST

export const banlistByDate = (date: string) => BANLISTS.find((list) => list.date === date)

export const banlistPath = (list: Banlist) => `/banlist-timeline/${list.date}`

/** `pot-of-greed`: a card's page, and the `#card=` hash that opens its history on a list's page. */
export const cardSlug = (card: number) =>
  cardName(card).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const cardBySlug = (slug: string) => BANLIST_CARDS.findIndex((_, card) => cardSlug(card) === slug)

export const cardPath = (card: number) => `/banlist-timeline/card/${cardSlug(card)}`

/** Every change to one card, oldest first. */
export const cardChanges = (card: number) =>
  BANLISTS.flatMap((list) => list.changes.filter((change) => change.card === card).map((change) => ({ list, ...change })))

/** A list's date at UTC midnight, for formatters. */
export const listDate = (date: string) => new Date(`${date}T00:00:00Z`)
