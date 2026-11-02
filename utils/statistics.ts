/**
 * The public ranked statistics: omega-server-v3 docs/front/STATISTICS_API.md.
 * Rates are 0–1 fractions, `null` when their denominator is 0; `games` are the deck's own games.
 */
import type { Size } from '@omega/infographic/infographic'
import { API_URL } from '@utils/auth'
import { log } from '@utils/log'
import type { RankedLadderId, Tier } from '@utils/types'

/**
 * The wide and tall URLs of one PNG route: `path?…query&size=wide|tall`. Not beside `InfographicLinks`:
 * that is a client module, and PlayerStatistics, a server component, calls this.
 */
export const infographicHrefs = (path: string, query: Record<string, string>): Record<Size, string> => ({
  wide: `${path}?${new URLSearchParams({ ...query, size: 'wide' })}`,
  tall: `${path}?${new URLSearchParams({ ...query, size: 'tall' })}`,
})

/** Hourly counts by UTC hour, moved to a clock `offset` hours behind UTC (`getTimezoneOffset() / 60`). */
export const localHours = (hours: readonly number[], offset: number) => hours.map((_, hour) => hours[Math.floor(((hour + offset) % 24 + 24) % 24)] ?? 0)

export type Result<T> = { ok: true; data: T } | { ok: false; status: number }

export type Window = 'season' | 'last7'
/** What every statistics page reads from the URL. `season` (a code) wins over `ladder` server-side. */
export type Scope = { ladder: RankedLadderId; season?: string; window: Window; band: string }
export type StatisticsScope = Pick<Scope, 'ladder' | 'season'> & Partial<Scope>

export const BANDS = ['all', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Omega'] as const

/** `searchParams` to a scope; anything the API would answer 400 to is the default. */
export const scopeFrom = (q: { ladder?: string | string[]; season?: string | string[]; window?: string | string[]; band?: string | string[] }): Scope => ({
  ladder: q.ladder === 'genesys' ? 'genesys' : 'tcg',
  season: typeof q.season === 'string' && q.season ? q.season : undefined,
  window: q.window === 'last7' ? 'last7' : 'season',
  band: (BANDS as readonly unknown[]).includes(q.band) ? (q.band as string) : 'all',
})

export const scopeQuery = ({ ladder, season, window = 'season', band = 'all' }: StatisticsScope) =>
  new URLSearchParams({ ...(season ? { season } : { ladder }), ...(window === 'season' ? {} : { window }), ...(band === 'all' ? {} : { band }) }).toString()

export const statisticsHref = (scope: StatisticsScope) => `/statistics?${scopeQuery(scope)}`
/** `*` stays readable in the path; `>` goes as %3E. */
export const deckHref = (key: string, scope: StatisticsScope) => `/statistics/archetypes/${encodeURIComponent(key)}?${scopeQuery(scope)}`
export const cardHref = (id: number, scope: StatisticsScope) => `/statistics/cards/${id}?${scopeQuery(scope)}`

export type Season = { id: number; code: string; ladder: RankedLadderId; label: string; startsAt: string; endsAt: string | null; sweptThrough: string | null }
export type Fit = { band: string; players: number; games: number; decks: number; firstEffect: number; ratingEffect: number; matchupStrength: number; cardStrength: number; phiMedian: number; builtAt: string }

export type DeckStat = {
  /** `''` unknown, `A`, `A>B` (A leads) or `A*` (every key A leads, summed). Use it as the id; `name` is only the label. */
  key: string
  name: string | null
  games: number
  matches: number
  players: number
  share: number
  wins: number
  losses: number
  draws: number
  wrRaw: number | null
  strength: number
  strengthSe: number
  phi: number
  /** The headline: the win rate the model expects against the window's field, with its 95% interval. */
  wrExpected: number
  wrLo: number
  wrHi: number
  /** `null` under the floors (0.5% share, 10 duelists) or the anchors, even with `wrExpected` present. */
  tier: 1 | 1.5 | 2 | 3 | 4 | null
  firstEffect: number
  firstSe: number
  g1Games: number
  g1Wr: number | null
  postGames: number
  postWr: number | null
  firstG1Wr: number | null
  secondG1Wr: number | null
  pilotShare: number
  mirrorShare: number
}

export type Matchup = {
  key: string
  opponent: string
  opponentName: string | null
  games: number
  wins: number
  losses: number
  draws: number
  wrRaw: number | null
  /** What the strengths, who went first and the ratings predict for the pair. */
  wrExpected: number
  /** The observed rate shrunk toward `wrExpected`; `wrLo`/`wrHi` is its interval. */
  wrAdjusted: number
  wrLo: number
  wrHi: number
  firstWr: number | null
  secondWr: number | null
}

export type Week = { key: string; week: number; firstDay: string; games: number; share: number; strength: number; se: number; wrExpected: number; jump: -1 | 0 | 1 }

export type CardStat = {
  /** The deck's key, `*` on the whole-window row. */
  key: string
  card: number
  /** The deck's name, on the rows of a card's page only. */
  name?: string | null
  lists: number
  inclusion: number
  copies: number | null
  sideRate: number
  playRate: number | null
  /** Logit effect on winning of having it in the list; `null` under 10% or over 90% of the lists, or under 200 games. */
  effect: number | null
  effectSe: number | null
  activations: number
  responded: number
  extra: boolean
}

export type AgainstCard = { id: number; name: string | null; games: number; rate: number; winRate: number | null }

export type Meta = { season: Season; window: Window; band: string; bands: { band: string; players: number }[]; fit: Fit; decks: DeckStat[]; weeks: Week[] }
export type DeckAnswer = { deck: DeckStat; matchups: Matchup[]; cards: CardStat[]; weeks: Week[]; byBand: (DeckStat & { band: string })[]; against: AgainstCard[]; sampleDeck: SampleDeck | null }
export type CardAnswer = { card: { id: number; name: string | null; extra: boolean }; all: CardStat; byDeck: CardStat[] }

export type Tally = { games: number; wins: number; losses: number; draws: number }
export type Tally3 = Omit<Tally, 'games'>
type PlayerEstimate = Tally & { name: string | null; wr: number | null; wrLo: number | null; wrHi: number | null; ladder: DeckStat | null }
export type PlayerDeck = PlayerEstimate & { key: string }
export type PlayerMatchup = PlayerEstimate & { key: string; opponent: string; opponentName: string | null }
/** One per duel, newest first: [day ISO, duel result, deck key | null, the opponent's, games won, lost, drawn]. */
export type TimelineRow = [day: string | null, result: 'W' | 'L' | 'D' | null, deck: string | null, opponent: string | null, wins: number, losses: number, draws: number]
export type PlayerAnswer = { season: Season | null; record: Tally; decks: PlayerDeck[]; matchups: PlayerMatchup[]; timeline: TimelineRow[] }

export type MatchupCall = 'favorable' | 'neutral' | 'unfavorable'
/** The API sends no verdict: a matchup is called only when its interval excludes the expected rate. */
export const matchupCall = ({ wrLo, wrHi, wrExpected }: Pick<Matchup, 'wrLo' | 'wrHi' | 'wrExpected'>): MatchupCall =>
  wrExpected < wrLo ? 'favorable' : wrExpected > wrHi ? 'unfavorable' : 'neutral'

/** A matchup list hides anything smaller by default: under it, the interval says more than the rate. */
export const MIN_MATCHUP_GAMES = 100

/** The decks proper: `A*` rows repeat the games of the keys they sum, and `''` is nobody's deck. */
export const plainDecks = <D extends { key: string }>(decks: readonly D[]): D[] => decks.filter((d) => d.key && !d.key.endsWith('*'))

/** The deck with the best share-weighted adjusted rate against the `top` most played; one missing any of them doesn't count. */
export const bestAgainst = (decks: readonly DeckStat[], matchups: readonly Matchup[], top = 5): { key: string; wr: number } | null => {
  const played = [...decks].sort((a, b) => b.share - a.share).slice(0, top)
  const rate = new Map(matchups.map((m) => [`${m.key}|${m.opponent}`, m.wrAdjusted]))
  let best: { key: string; wr: number } | null = null
  for (const { key } of decks) {
    let sum = 0
    let weight = 0
    let complete = true
    for (const opponent of played) {
      if (opponent.key === key) continue
      const wr = rate.get(`${key}|${opponent.key}`)
      if (wr === undefined) {
        complete = false
        break
      }
      sum += wr * opponent.share
      weight += opponent.share
    }
    if (complete && weight && (!best || sum / weight > best.wr)) best = { key, wr: sum / weight }
  }
  return best
}

const sigma = (x: number) => 1 / (1 + Math.exp(-x))
const logit = (p: number) => Math.log(p / (1 - p))

/** A logit value (`firstEffect`, a card's `effect`) as points of win rate around 50%: σ(x) − 0.5. */
export const effectPoints = (x: number) => (sigma(x) - 0.5) * 100

/** A week's 95% band: its `se` is on the logit scale. */
export const weekBand = ({ wrExpected, se }: Pick<Week, 'wrExpected' | 'se'>) => ({ lo: sigma(logit(wrExpected) - 1.96 * se), hi: sigma(logit(wrExpected) + 1.96 * se) })

/** In this share of the lists or more, a card is the deck's core; under it, a flex slot. */
export const CORE_RATE = 0.8
export const coreFlex = <C extends Pick<CardStat, 'inclusion'>>(cards: readonly C[]) => ({ core: cards.filter((c) => c.inclusion >= CORE_RATE), flex: cards.filter((c) => c.inclusion < CORE_RATE) })

const lastWeek = (weeks: readonly Week[]) => Math.max(0, ...weeks.map((w) => w.week))

/** The biggest share moves of the last week against the one before; a deck in only one of them doesn't count. */
export const shareMoves = (weeks: readonly Week[], top = 5) => {
  const last = lastWeek(weeks)
  const before = new Map(weeks.filter((w) => w.week === last - 1).map((w) => [w.key, w.share]))
  const moves = weeks.flatMap((w) => {
    const from = w.week === last ? before.get(w.key) : undefined
    return from === undefined ? [] : [{ key: w.key, delta: w.share - from }]
  })
  return {
    risers: moves.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, top),
    fallers: moves.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, top),
  }
}

export const weekJumps = (weeks: readonly Week[]) => {
  const last = lastWeek(weeks)
  return weeks.filter((w) => w.week === last && w.jump !== 0)
}

/** The swept days the window really holds: `last7` on day 2 of a season is 2. */
export const windowDays = ({ window, season, weeks }: Pick<Meta, 'window' | 'season' | 'weeks'>) => {
  if (!season.sweptThrough) return 0
  const first = weeks.reduce((min, w) => (w.firstDay < min ? w.firstDay : min), season.startsAt.slice(0, 10))
  const days = Math.round((Date.parse(season.sweptThrough) - Date.parse(first)) / 86_400_000) + 1
  return window === 'last7' ? Math.min(7, days) : days
}

/** Above or below the deck only when the two intervals don't touch. */
export const meVerdict = ({ wrLo, wrHi, ladder }: Pick<PlayerDeck, 'wrLo' | 'wrHi' | 'ladder'>) =>
  wrLo == null || wrHi == null || !ladder ? null : wrLo > ladder.wrHi ? ('above' as const) : wrHi < ladder.wrLo ? ('below' as const) : ('same' as const)

const read = async <T>(path: string, call: string, init: RequestInit & { next?: { revalidate: number } } = { next: { revalidate: 300 } }): Promise<Result<T>> => {
  try {
    const res = await fetch(`${API_URL}${path}`, init)
    return res.ok ? { ok: true, data: (await res.json()) as T } : { ok: false, status: res.status }
  } catch (error) {
    log('error', 'API_ERROR', { call, path, err: error })
    return { ok: false, status: 0 }
  }
}

/** Newest first; empty when the server can't answer. */
export const getSeasons = async (): Promise<Season[]> => {
  const result = await read<{ seasons: Season[] }>('/statistics/seasons', 'GET /statistics/seasons')
  return result.ok ? result.data.seasons : []
}

export const getMeta = (scope: Scope) => read<Meta>(`/statistics/meta?${scopeQuery(scope)}`, 'GET /statistics/meta')

export const getDeck = (key: string, scope: Scope) => read<DeckAnswer>(`/statistics/decks/${encodeURIComponent(key)}?${scopeQuery(scope)}`, 'GET /statistics/decks/:key')

export const getCard = (id: number, scope: StatisticsScope) => read<CardAnswer>(`/statistics/cards/${id}?${scopeQuery(scope)}`, 'GET /statistics/cards/:id')

/** Owner only (403 otherwise), live from the games: on the server, pass the incoming `cookie`. */
export const getPlayerStatistics = (id: string, { ladder, season }: Pick<Scope, 'ladder' | 'season'>, cookie: string | null) =>
  read<PlayerAnswer>(`/statistics/players/${encodeURIComponent(id)}?${scopeQuery({ ladder, season })}`, 'GET /statistics/players/:id', { cache: 'no-store', headers: cookie ? { cookie } : undefined })

/** GET /statistics/omega: logins and ranked activity of the whole game. */
export type OmegaCard = { current: number; previous: number | null }
type TierCell = { games: number; players: number }
export type OmegaRange = 7 | 14 | 30
type OmegaLadder = {
  population: { tier: Tier; players: number }[]
  daily: { day: string; tiers: Partial<Record<Tier, TierCell>> }[]
  totals: Record<OmegaRange, Partial<Record<Tier, TierCell>>>
}
export type OmegaActivity = {
  updatedAt: string
  today: string
  cards: Record<'logins' | 'weekLogins' | 'duels' | 'weekDuels', OmegaCard>
  daily: { day: string; logins: number | null; duels: number; players: number }[]
  totals: Record<OmegaRange, TierCell>
  /** Duels started in each UTC hour, average per day. Absent from an older server. */
  hours?: number[]
  ladders: Record<RankedLadderId, OmegaLadder>
}

/** null when the server can't answer: the page goes on without the section. */
export const getOmegaActivity = async (): Promise<OmegaActivity | null> => {
  const result = await read<OmegaActivity>('/statistics/omega', 'GET /statistics/omega', { next: { revalidate: 600 } })
  return result.ok ? result.data : null
}

/**
 * A sample deck: not a played deck, the most included cards of the archetype at their usual copies,
 * inside the current banlist. Rebuilt after every sweep; `deckId` is its public deck.
 */
export type SampleDeck = {
  archetype: number[]
  name: string | null
  /** Decklists it was built from. */
  lists: number
  deckId: string | null
  coverCardId: number | null
  createdAt: string
  updatedAt: string
  main: SampleCard[]
  extra: SampleCard[]
  side: SampleCard[]
}
export type SampleCard = { id: number; name: string | null; count: number }

type FaceSource = { deck: Pick<DeckStat, 'key'>; cards: Pick<CardStat, 'card'>[]; sampleDeck: Pick<SampleDeck, 'coverCardId'> | null }

/** The card that stands for each deck, by key: no two decks on a board look the same. */
export const deckFaces = (answers: readonly FaceSource[]) => {
  const taken = new Set<number>()
  return new Map(
    answers.flatMap(({ deck, cards, sampleDeck }) => {
      const face = [sampleDeck?.coverCardId, ...cards.map((c) => c.card)].find((id): id is number => !!id && !taken.has(id))
      if (!face) return []
      taken.add(face)
      return [[deck.key, face] as const]
    }),
  )
}
