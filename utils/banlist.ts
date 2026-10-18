import { CARDS, IDS, LISTS } from './banlist-data'

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

export const SOURCE = 'https://yugipedia.com/wiki/Historic_Forbidden/Limited_Chart'

/** Swatch fill, label color and text on the fill, per status. */
export const STATUS_TONE: Record<BanStatus, { fill: string; text: string; on: string }> = {
  F: { fill: 'bg-crimson', text: 'text-crimson-lift', on: 'text-ink' },
  L: { fill: 'bg-tier-bronze', text: 'text-tier-bronze', on: 'text-space-000' },
  S: { fill: 'bg-gold', text: 'text-gold', on: 'text-gold-on' },
  U: { fill: 'bg-win', text: 'text-win', on: 'text-space-000' },
  N: { fill: 'bg-azure-lift', text: 'text-azure-lift', on: 'text-space-000' },
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

/**
 * A year label under the first list of each even year, blank elsewhere: an axis for anything drawn per list.
 * A label closer than 5 lists to the one before is dropped, or the two would overlap.
 */
export const YEAR_TICKS = (() => {
  let last = -Infinity
  return BANLISTS.map(({ date }, i) => {
    const year = date.slice(0, 4)
    if (year === BANLISTS[i - 1]?.date.slice(0, 4) || Number(year) % 2 || i - last < 5) return ''
    last = i
    return year
  })
})()

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

/** Passcode per card, in `BANLIST_CARDS` order: its artwork and its wiki page. */
export const BANLIST_IDS = IDS.split(',').map(Number)

export const cardId = (card: number) => BANLIST_IDS[card] ?? 0

/** The card a passcode is, or -1 when it was never on a TCG list. */
export const cardByPasscode = (id: number) => BANLIST_IDS.indexOf(id)

export const wikiPath = (card: number) => `/wiki/card/${cardId(card)}`

/** 0 strictest (Forbidden) to 3 free (Unlimited, or never listed). */
const RANK: Record<BanStatus, number> = { F: 0, L: 1, S: 2, U: 3, N: 3 }

/** Whether a change tightens or loosens the card. */
export const direction = ({ from, to }: { from: BanStatus; to: BanStatus }) => (RANK[to] < RANK[from] ? 'down' : 'up')

/** Every change to one card, oldest first. */
export const cardChanges = (card: number) =>
  BANLISTS.flatMap((list) => list.changes.filter((change) => change.card === card).map((change) => ({ list, ...change })))

/** A list's date at UTC midnight, for formatters. */
export const listDate = (date: string) => new Date(`${date}T00:00:00Z`)
