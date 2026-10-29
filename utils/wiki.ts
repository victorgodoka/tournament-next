/**
 * Public card and banlist reads on omega-server-v3 (see its CARDS_API.md), plus the display helpers
 * the wiki needs. Everything here is anonymous and safe to cache: card data changes at most once a
 * day, so responses are revalidated on the hour rather than fetched per request.
 */
import { cache } from 'react'
import { API_URL } from './auth'

export type CardKind = 'monster' | 'spell' | 'trap'

/** A previous wording of a card. `date` is when *that* version shipped in the TCG. */
type Errata = { id: number; description: string; date: string | null }

/** Only the lists that restrict the card. Copies on a normal list, points on a Genesys one. */
type CardBanlistEntry = { name: string; limitation: number }

type Translation = { name: string; desc: string } | null

export type WikiCard = {
  id: number
  /**
   * The card's identity: the OCG passcode on the TCG print of a double-script card (e.g. Ecclesia and
   * the Dark Dragon, TCG 78397691 → 78397661), `id` on every other card. Key links and banlists by
   * this; `id` is the print shown. A deck stores the print for its format (utils/deck/model `passcodeIn`).
   */
  idOriginal: number
  /** A double-script card's TCG passcode, on both prints; `null` on every other card. */
  idTcg: number | null
  /**
   * The passcode the image host has art for: the current card's on a pre-errata version (Armory Arm 29071352 →
   * 29071332), the OCG print's on a double-script TCG print, `id` otherwise. Name and text stay this card's.
   * Build URLs through `imageOf` (utils/deck/model), which keeps an alternate artwork's own passcode.
   */
  imageId: number
  name: string
  description: string
  kind: CardKind
  humanReadableCardType: string
  monsterTypes: string[]
  spellTrapType: string | null
  race: string | null
  attribute: string | null
  /** Level, Rank or Link Rating — label it from `monsterTypes`. */
  level: number | null
  scale: number | null
  /** `-2` is the printed `?`. */
  atk: number | null
  /** `null` for spells, traps and Link monsters. */
  def: number | null
  linkMarkers: string[]
  archetypes: string[]
  supports: string[]
  ruleId: number | null
  alias: number | null
  alternateArts: number[]
  erratas: Errata[]
  released: { ocg: string | null; tcg: string | null }
  banlists: CardBanlistEntry[] | null
  i18n: { pt: Translation; jp: Translation }
}

export type Banlist = {
  id: number
  name: string
  format: string
  /** Non-null on a Genesys list. Branch on this, never on the id or the name. */
  pointCap: number | null
  bannedTypes: string[]
  cards: number
}

/** Card data is republished daily; the API asks callers not to cache-bust it. */
const DAILY = { next: { revalidate: 3600 } } as const

/** `null` for an unknown passcode. Anything else unexpected throws. */
export const getCard = cache(async (id: string): Promise<WikiCard | null> => {
  const res = await fetch(`${API_URL}/cards/${encodeURIComponent(id)}`, DAILY)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET /cards/${id} failed with ${res.status}`)
  return res.json()
})

/** Empty on failure: a card page still reads without its legality table. */
export const getBanlists = cache(async (): Promise<Banlist[]> => {
  try {
    const res = await fetch(`${API_URL}/banlists`, DAILY)
    if (!res.ok) throw new Error(`GET /banlists failed with ${res.status}`)
    return res.json()
  } catch (error) {
    console.error(error)
    return []
  }
})

/** Chip tones: banned gold (caution), limited indigo, priced cyan, free neutral. */
export type Tone = 'gold' | 'cyan' | 'indigo' | 'neutral'

export type LegalityRow = { list: string; status: string; copies: string; tone: Tone }

const COPY_STATUS = ['Forbidden', 'Limited', 'Semi-Limited']

/**
 * One row per list, including the lists the card is free on — `card.banlists` carries restrictions
 * only, so an absent entry is "unlimited", not "unknown".
 *
 * The trap is Genesys: it bans Pendulum and Link monsters outright, and a banned *type* is never a
 * points entry, so a Link monster looks exactly like a free card on the card object alone. The ban
 * has to be read off the list's `bannedTypes`.
 */
export const legalityRows = (card: WikiCard, banlists: Banlist[]): LegalityRow[] =>
  banlists.map((list) => {
    const entry = card.banlists?.find((b) => b.name === list.name)

    if (list.pointCap === null) {
      return {
        list: list.name,
        status: entry ? COPY_STATUS[entry.limitation] ?? 'Restricted' : 'Unlimited',
        copies: String(entry?.limitation ?? 3),
        tone: !entry ? 'neutral' : entry.limitation === 0 ? 'gold' : 'indigo',
      }
    }

    if (card.monsterTypes.some((type) => list.bannedTypes.includes(type))) {
      return { list: list.name, status: 'Banned type', copies: '0', tone: 'gold' }
    }

    const points = entry?.limitation ?? 0
    return {
      list: list.name,
      status: `${points} points`,
      copies: '3',
      tone: points ? 'cyan' : 'neutral',
    }
  })

/** Level, Rank or Link Rating. The field is the same, the label is not. */
export const levelLabel = (card: WikiCard) =>
  card.monsterTypes.includes('xyz') ? 'Rank' : card.monsterTypes.includes('link') ? 'Link Rating' : 'Level'

/** `-2` is the printed `?`, never a number. */
export const statLabel = (value: number | null) => (value === null ? '—' : value === -2 ? '?' : String(value))

/** `winged_beast` as the card prints it. */
export const titleCase = (value: string) =>
  value.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

const DATE = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })

export const releaseDate = (iso: string | null) => (iso ? DATE.format(new Date(`${iso}T00:00:00Z`)) : 'Never released')

/**
 * When the card first existed in the TCG. An errata'd card's `released.tcg` is when its *current*
 * wording came out, so the oldest errata date can predate it by years.
 */
export const tcgDebut = (card: WikiCard) =>
  [card.released.tcg, ...card.erratas.map((errata) => errata.date)]
    .filter((date): date is string => !!date)
    .sort()[0] ?? null

/** Attribute colours, matching the card frames rather than the site palette. */
export const ATTRIBUTE_COLOR: Record<string, string> = {
  dark: 'text-azure-lift',
  light: 'text-cyan',
  fire: 'text-cyan',
  water: 'text-cyan',
  earth: 'text-ink-dim',
  wind: 'text-cyan',
  divine: 'text-cyan',
}
