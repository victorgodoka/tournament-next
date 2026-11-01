/**
 * The public meta statistics of a ranked season: omega-server-v3 STATISTICS_API.md.
 * Rates are 0–1 fractions, `null` when their denominator is 0; `games` are always deck-games.
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

/** One entry, or two for a mixed deck. Use it as the key; `name` is only the label. */
export type ArchetypeKey = number[]
export type Side = { games: number; winRate: number | null }
export type TurnSplit = { first: Side; second: Side }

type WilsonInterval = { lower: number; upper: number; margin: number }
/** The win rate shrunk toward a prior and widened by the deck's overdispersion: what tiers, rankings and the matchup call read (STATISTICS_API.md). */
export type Estimate = { mean: number; lower: number; upper: number; margin: number }
export type MatchupStatus = 'favorable' | 'neutral' | 'unfavorable'
/** Favorable when the whole 95% interval is above 50%, unfavorable when it is all below. The API sends no status; this is the page's reading. */
export const matchupStatus = (ci: WilsonInterval | undefined): MatchupStatus => (!ci ? 'neutral' : ci.lower > 0.5 ? 'favorable' : ci.upper < 0.5 ? 'unfavorable' : 'neutral')
/** The interval a call reads: the adjusted one; the raw Wilson one from a server or snapshot without it. */
export const intervalOf = (x: { adjusted?: Estimate; ci?: WilsonInterval }): WilsonInterval | undefined => x.adjusted ?? x.ci
/** A deck's (or matchup's) score: the adjusted win rate; the Wilson lower bound from a server without it. */
export const strengthOf = (x: { adjusted?: Estimate; wilsonLower: number | null }) => x.adjusted?.mean ?? x.wilsonLower
/** The window `growth` covers on the server: half the synced days, at most 7. */
export const growthDays = (syncedDays: number) => Math.min(7, Math.max(1, Math.floor(syncedDays / 2)))
/** Hourly counts by UTC hour, moved to a clock `offset` hours behind UTC (`getTimezoneOffset() / 60`). */
export const localHours = (hours: readonly number[], offset: number) => hours.map((_, hour) => hours[Math.floor(((hour + offset) % 24 + 24) % 24)] ?? 0)
export type RankingMode = 'mostPlayed' | 'highestWinRate' | 'rising' | 'sleeper' | 'consistent'
export const RANKING_MODES: readonly RankingMode[] = ['mostPlayed', 'highestWinRate', 'rising', 'sleeper', 'consistent']

export type MatchupOthers = {
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number | null
  wilsonLower: number
  ci: WilsonInterval
  turnOrder: TurnSplit
  sideboarding: { game1: Side; postSide: Side }
}

type TierDistribution = {
  tier1: { share: number; archetypes: number }
  /** Absent from a server older than Tier 1.5. */
  tier15?: { share: number; archetypes: number }
  tier2: { share: number; archetypes: number }
  tier3: { share: number; archetypes: number }
  tier4: { share: number; archetypes: number }
  others: { share: number; archetypes: number }
}

/** One day of a deck's trend: `[seasonDay, metaShare, winRate | null, games?]`. */
export type TrendPoint = [number, number, number | null, number?]

export type RankingsSummary = {
  mostPlayed: ArchetypeKey[]
  highestWinRate: ArchetypeKey[]
  rising: ArchetypeKey[]
  sleeper: ArchetypeKey[]
  consistent: ArchetypeKey[]
}

/** Share or win-rate shift between a block of days and the one before it; `from`/`to` are 0–1. The API sends no text. */
export type MetaEvent = {
  day: number
  kind: 'shareRise' | 'shareDrop' | 'winRateRise' | 'winRateDrop'
  archetype: ArchetypeKey
  /** Absent from an older server or a season built before it. */
  name?: string | null
  from: number
  to: number
  games: number
}

export type StatCard = {
  id: number
  name: string | null
  inclusion: number
  /** Deck-games with it in the registered side ÷ the deck's deck-games with a decklist. `null` before the sweep counted it; absent from an older server. */
  sideRate?: number | null
  averageCopies: number
  playRate: number | null
  /** `null` when part of the season was recorded the old way: "not enough data". */
  winRateWhenUsed: number | null
  winRateInDeck: number | null
}

/** A generic card the opponent used against the deck. `games`: the deck's games where the other side used it; `rate`: of the deck's games; `winRate`: the deck's, in those games. */
/** `group`: the opponent's engine the row sums up (its cards fold into one line); `id` and `name` are the engine's cover and name then. */
export type AgainstCard = { id: number; name: string | null; group?: number | null; handTrap: boolean; games: number; rate: number | null; winRate: number | null }

/** `cards`: every card of the group seen in the archetype. Absent from a server older than the field. */
export type CardGroup = { id: number; name: string; inclusion: number; winRate: number | null; cards?: StatCard[] }

type Pace = { averageTurns: number | null; actionsPerTurn: number | null; turn1SpecialSummons: number | null; averageLongestChain: number | null }
export type DeckListCard = { id: number; name: string | null; main: number; copies: number | null; side: number; sideCopies: number | null }

export type StatArchetype = {
  archetype: ArchetypeKey
  name: string | null
  games: number
  metaShare: number
  tier?: 1 | 1.5 | 2 | 3 | 4 | null
  growth?: number
  /** Worst Wilson lower bound across day blocks; null without two blocks of sample. */
  consistencyScore?: number | null
  /** Wilson lower bound below 5% meta share, null above. */
  sleeperScore?: number | null
  wins: number
  losses: number
  draws: number
  winRate: number | null
  wilsonLower: number | null
  ci?: WilsonInterval
  /** Shrunk toward the ladder's mean, widened by `overdispersion`; absent from an older server or snapshot. */
  adjusted?: Estimate
  /** φ: how much its daily win rate varied beyond a binomial (1 = independent games). */
  overdispersion?: number
  mirrorShare: number
  players: number
  /** Share of its deck-games from its 5 busiest duelists. The fields down to `deckList` are absent from a season frozen before them. */
  pilotShare?: number | null
  /** Its share inside each `ratingTiers` band, same order. */
  ratingShares?: (number | null)[] | null
  unfinishedRate?: number | null
  turnOrder: TurnSplit
  sideboarding: { game1: Side; postSide: Side }
  turnByGame?: { first: { game1: Side; postSide: Side }; second: { game1: Side; postSide: Side } }
  paceByResult?: { win: Pace; loss: Pace }
  /** Every card of the registered lists past 10%, tracked or not. `main` and `side`: share of `lists`. */
  deckList?: { lists: number; cards: DeckListCard[] } | null
  byGame?: { g1: Side; g2: Side; g3: Side }
  matchupOthers?: MatchupOthers
  pace: Pace
  /** Its own (archetype / Series) most included card: the deck's art. Absent from an older server. */
  face?: { id: number; name: string | null }
  cards: StatCard[]
  /** `cards` without the deck's own archetype cards: generic ones only (a group's, or without a setcode). Absent from an older server. */
  staples?: StatCard[]
  engines: CardGroup[]
  techs: CardGroup[]
  /** Generic cards the opponent used against the deck, most games first. `null`: swept before the block; absent from an older server. */
  against?: AgainstCard[] | null
}

/** A section 03 row: no engines or techs, `cards` cut to the face card. */
export type LeanArchetype = Omit<StatArchetype, 'engines' | 'techs' | 'against' | 'staples'>

export type Matchup = {
  archetype: ArchetypeKey
  opponent: ArchetypeKey
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number | null
  wilsonLower: number | null
  ci?: WilsonInterval
  /** Shrunk toward the deck's own adjusted win rate; absent from an older server or snapshot. */
  adjusted?: Estimate
  turnOrder?: TurnSplit
  sideboarding?: { game1: Side; postSide: Side }
  averageTurns?: number | null
  /** The hand traps the opponent used most in the matchup; `rate`: of its deck-games. */
  handTraps?: { id: number; name: string | null; rate: number | null }[]
}

/** Rates are 0–1; `null` is "not enough data" (days swept before the counters, or no denominator). */
export type MostUsedCard = {
  id: number
  name: string | null
  handTrap: boolean
  /** Extra Deck card: the row's side, also for a searched card outside the list. */
  extra: boolean
  popularity: number
  usageRate: number | null
  winRateWhenUsed: number | null
  winRateWith?: number | null
  winRateWithout?: number | null
  topArchetypes?: string[]
  /** The decks with the most games running it. */
  byArchetype?: { archetype: ArchetypeKey; name: string | null; inclusion: number; copies: number | null; usage: number | null; winRateInDeck: number | null }[]
  detail: {
    decklists: { mainExtra: number | null; side: number | null }
    usage: { game1: number | null; postSide: number | null }
    winRate: { match: number | null; game1: number | null; postSide: number | null }
    responded: {
      activations: number
      rate: number | null
      dominus: number | null
      yokaiGirls: number | null
      psyFrame: number | null
      calledCrossout: number | null
      impermanence: number | null
      mulcharmy: number | null
      solemn: number | null
      others: number | null
      /** The cards that answered it most; `share`: of all responses. */
      exact?: { id: number; name: string | null; share: number | null }[]
    }
  }
}

export type Statistics = {
  season: { id: number; code: string; label: string; ladder: RankedLadderId; startsAt: string; endsAt: string | null }
  syncedDays: { count: number; first: string | null; last: string | null }
  minSamples: number
  totals: { games: number; matches: number; players: number; archetypes: number }
  tierDistribution?: TierDistribution
  /** Lowest first; a band of few duelists joins the one below (`plus`). Their rating now, not at game time. */
  ratingTiers?: { tier: string; plus: boolean; players: number; games: number }[]
  rankings?: RankingsSummary
  /** The fitted priors: a deck with `strength` games sits halfway between its sample and `mean`. `null` on an old snapshot, absent from an older server. */
  inference?: { prior: { mean: number; strength: number }; matchupStrength: number } | null
  turnOrder: { all: TurnSplit; game1: TurnSplit; postSide: TurnSplit }
  archetypes: StatArchetype[]
  matchups: Matchup[]
  /** Generic cards in 2+ archetypes, 30 a part, most popular first. */
  mostUsed: { main: MostUsedCard[]; extra: MostUsedCard[] }
  /** Open season only, in the listed archetypes' order. Absent from an older server. */
  sampleDecks?: SampleDeck[]
  metaEvents?: MetaEvent[]
  /** Points are `[seasonDay, metaShare, winRate | null, games]`, day 1 = opening day; `games` is absent from an older server. */
  /** `tiers`: one per point, the tier over the 7 days ending that day. */
  trends: { archetype: ArchetypeKey; name: string | null; points: TrendPoint[]; tiers?: (StatArchetype['tier'])[] }[]
  /**
   * Section 03 rows, by games. `general` `[A]`: pure A plus every mix A leads (`generalCount` before the cut);
   * `pure` `[A]`: a listed General key's pure decks, when the build has them; `combined` `[lead, second]`.
   * `null` for a season frozen before modes.
   */
  views: { general: LeanArchetype[]; generalCount: number; pure: LeanArchetype[]; combined: LeanArchetype[] } | null
}

export type StatisticsResult = { ok: true; data: Statistics } | { ok: false; status: number }

/**
 * `season` (a code) wins over `ladder` server-side, so only one is sent. Cached 5 minutes like the
 * endpoint; a network failure comes back as status 0.
 */
export const getStatistics = async ({ ladder, season, ranking, archetypes }: { ladder: RankedLadderId; season?: string; ranking?: RankingMode; archetypes?: number }): Promise<StatisticsResult> => {
  const params = new URLSearchParams(season ? { season } : { ladder })
  if (ranking) params.set('ranking', ranking)
  if (archetypes) params.set('archetypes', String(archetypes))
  try {
    // A long list runs to ~6 MB, past the 2 MB the data cache takes.
    const res = await fetch(`${API_URL}/statistics?${params}`, archetypes ? { cache: 'no-store' } : { next: { revalidate: 300 } })
    return res.ok ? { ok: true, data: (await res.json()) as Statistics } : { ok: false, status: res.status }
  } catch (error) {
    log('error', 'API_ERROR', { call: 'GET /statistics', query: params.toString(), err: error })
    return { ok: false, status: 0 }
  }
}

/**
 * GET /statistics/players/:id (STATISTICS_API.md §6): the same report over one duelist's side.
 * `season: null` = every season of `formats`. Only the newest 1000 matches are read (`matches`).
 */
export type PlayerStatisticsData = Omit<Statistics, 'season' | 'syncedDays' | 'minSamples'> & {
  season: Statistics['season'] | null
  formats: ('TCG' | 'Genesys')[]
  matches: { analyzed: number; total: number }
  record: PersonalRecord
}

export type Tally3 = { wins: number; losses: number; draws: number }

/**
 * The duelist's own record, mirrors in (STATISTICS_API.md §6). Counts only; a deck nobody could name is
 * in `matches`/`games` only. `decks` and `matchups` come by matches, most first.
 */
type PersonalRecord = {
  matches: Tally3
  games: Tally3
  decks: { archetype: ArchetypeKey; name: string | null; matches: Tally3; games: Tally3 }[]
  matchups: { archetype: ArchetypeKey; opponent: ArchetypeKey; name: string | null; opponentName: string | null; matches: Tally3; games: Tally3 }[]
  /** One per analyzed match, newest first. Absent from an API older than the field. */
  timeline?: TimelineRow[]
  /** Name of every deck key in `timeline`. */
  deckNames?: Record<string, string | null>
}

/** [end ISO | null, match result, their deck key "1+2" | null, the opponent's, games won, lost, drawn]. */
export type TimelineRow = [end: string | null, result: 'W' | 'L' | 'D' | null, deck: string | null, opponent: string | null, wins: number, losses: number, draws: number]

/**
 * `season` wins over `ladder`; neither = every season of both ladders. Live from the duels (a few
 * seconds cold), behind the profile's visibility gate: on the server, pass the incoming `cookie`.
 */
export const getPlayerStatistics = async (
  id: string,
  query: { season?: string; ladder?: RankedLadderId },
  cookie: string | null,
): Promise<{ ok: true; data: PlayerStatisticsData } | { ok: false; status: number }> => {
  const params = new URLSearchParams(query.season ? { season: query.season } : query.ladder ? { ladder: query.ladder } : {})
  try {
    const res = await fetch(`${API_URL}/statistics/players/${encodeURIComponent(id)}?${params}`, {
      cache: 'no-store',
      headers: cookie ? { cookie } : undefined,
    })
    return res.ok ? { ok: true, data: await res.json() } : { ok: false, status: res.status }
  } catch (error) {
    log('error', 'API_ERROR', { call: 'GET /statistics/players/:id', id, query: params.toString(), err: error })
    return { ok: false, status: 0 }
  }
}

export const archKey = (a: ArchetypeKey) => a.join('-')

/**
 * `main`: the ranking's keys, one archetype or a sorted pair; `general`: every deck A leads; `pure`: decks of A alone
 * (the same row as `main` for one key); `combined`: mixes, key `[lead, second]` in that order.
 */
export type DeepDiveMode = 'main' | 'general' | 'pure' | 'combined'
const modeParams = (mode: DeepDiveMode): Record<string, string> => (mode === 'main' ? {} : { mode })

/** Keeps `?season=` or `?ladder=` on the way between the statistics pages. */
export type StatisticsScope = { ladder: RankedLadderId; season?: string }
const scopeQuery = ({ ladder, season }: StatisticsScope, extra: Record<string, string> = {}) =>
  new URLSearchParams({ ...(season ? { season } : { ladder }), ...extra }).toString()
export const statisticsHref = (scope: StatisticsScope) => `/statistics?${scopeQuery(scope)}`
export const deckHref = (key: ArchetypeKey, scope: StatisticsScope, mode: DeepDiveMode = 'main') =>
  `/statistics/archetypes/${archKey(key)}?${scopeQuery(scope, modeParams(mode))}`
export const cardHref = (id: number, scope: StatisticsScope) => `/statistics/cards/${id}?${scopeQuery(scope)}`

/** One searchable archetype of a ranked season. `ready`: in the season build or already calculated. */
export type IndexEntry = { archetype: ArchetypeKey; name: string | null; games: number; ready: boolean }
type DeepDiveRow = StatArchetype & { rank: number }
export type DeepDiveState =
  | { status: 'ready'; archetype: DeepDiveRow }
  | { status: 'missing' }
  | { status: 'queued'; position: number }
  | { status: 'running' }
  | { status: 'failed'; error: string }
  | { status: 'limited'; retryAt?: string }

/** Anything but a 2xx throws an Error carrying the HTTP status (`.status`). */
const ok = async (res: Response) => {
  if (!res.ok) throw Object.assign(new Error(`Statistics request failed (${res.status})`), { status: res.status })
  return res.json()
}

/** Every searchable archetype of the mode, most played first. */
export const getArchetypeIndex = async (season: string, mode: DeepDiveMode, signal?: AbortSignal): Promise<IndexEntry[]> =>
  (await ok(await fetch(`${API_URL}/statistics/archetypes?${new URLSearchParams({ season, ...modeParams(mode) })}`, { signal }))).archetypes

/** Always a state, never cached: poll it while `queued` or `running`. */
export const getDeepDive = async (season: string, mode: DeepDiveMode, key: ArchetypeKey, signal?: AbortSignal): Promise<DeepDiveState> =>
  ok(await fetch(`${API_URL}/statistics/archetype?${new URLSearchParams({ season, ...modeParams(mode), key: archKey(key) })}`, { cache: 'no-store', signal }))

/** Signed in only (`omega_session`). 429 is the account's hourly limit, not an error. */
export const requestDeepDive = async (season: string, mode: DeepDiveMode, key: ArchetypeKey): Promise<DeepDiveState> => {
  const res = await fetch(`${API_URL}/statistics/archetype`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ season, ...modeParams(mode), key: archKey(key) }),
  })
  /* The IP limiter answers 429 too, without a `retryAt`. */
  if (res.status === 429) return { status: 'limited', retryAt: (await res.json().catch(() => null))?.retryAt }
  return ok(res)
}

/** A card of the season found by name. `ready`: in the page's list or already calculated. */
export type CardMatch = { id: number; name: string | null; popularity: number | null; ready: boolean }
export type CardState =
  | { status: 'ready'; card: MostUsedCard }
  | Exclude<DeepDiveState, { status: 'ready' }>

/** Up to 20 cards whose name holds `q` (2+ characters), most played first. */
export const searchCards = async (season: string, q: string, signal?: AbortSignal): Promise<CardMatch[]> =>
  (await ok(await fetch(`${API_URL}/statistics/cards?${new URLSearchParams({ season, q })}`, { signal }))).cards

/** Always a state, never cached: poll it while `queued` or `running`. */
export const getCard = async (season: string, id: number, signal?: AbortSignal): Promise<CardState> =>
  ok(await fetch(`${API_URL}/statistics/card?${new URLSearchParams({ season, id: String(id) })}`, { cache: 'no-store', signal }))

/** Signed in only. Its own hourly limit, apart from the deep dive's; 429 comes back as `limited`. */
export const requestCard = async (season: string, id: number): Promise<CardState> => {
  const res = await fetch(`${API_URL}/statistics/card`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ season, id }),
  })
  if (res.status === 429) return { status: 'limited', retryAt: (await res.json().catch(() => null))?.retryAt }
  return ok(res)
}

/** GET /statistics/omega: logins and ranked activity of the whole game (STATISTICS_API.md §5). */
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
  try {
    const res = await fetch(`${API_URL}/statistics/omega`, { next: { revalidate: 600 } })
    return res.ok ? ((await res.json()) as OmegaActivity) : null
  } catch (error) {
    log('error', 'API_ERROR', { call: 'GET /statistics/omega', err: error })
    return null
  }
}

/**
 * A sample deck: not a played deck, the most included cards of the archetype at their usual copies,
 * inside the current banlist. Rebuilt after every sweep; `deckId` is its public deck.
 */
export type SampleDeck = {
  archetype: ArchetypeKey
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
