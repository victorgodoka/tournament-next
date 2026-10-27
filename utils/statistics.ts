/**
 * The public meta statistics of a ranked season: omega-server-v3 STATISTICS_API.md.
 * Rates are 0–1 fractions, `null` when their denominator is 0; `games` are always deck-games.
 */
import { API_URL } from '@utils/auth'
import type { RankedLadderId, Tier } from '@utils/types'

/** One entry, or two for a mixed deck. Use it as the key; `name` is only the label. */
export type ArchetypeKey = number[]
export type Side = { games: number; winRate: number | null }
export type TurnSplit = { first: Side; second: Side }

export type WilsonInterval = { lower: number; upper: number; margin: number }
export type MatchupStatus = 'favorable' | 'neutral' | 'unfavorable'
/** A matchup at or past `FAVORABLE` is favorable, under `UNFAVORABLE` unfavorable. The API sends only the rate; this is the page's reading. */
export const FAVORABLE = 0.52
export const UNFAVORABLE = 0.49
export const matchupStatus = (rate: number): MatchupStatus => (rate >= FAVORABLE ? 'favorable' : rate < UNFAVORABLE ? 'unfavorable' : 'neutral')
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

export type TierDistribution = {
  tier1: { share: number; archetypes: number }
  tier2: { share: number; archetypes: number }
  tier3: { share: number; archetypes: number }
  tier4: { share: number; archetypes: number }
  others: { share: number; archetypes: number }
}

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

export type StatArchetype = {
  archetype: ArchetypeKey
  name: string | null
  games: number
  metaShare: number
  tier?: 1 | 2 | 3 | 4 | null
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
  mirrorShare: number
  players: number
  turnOrder: TurnSplit
  sideboarding: { game1: Side; postSide: Side }
  byGame?: { g1: Side; g2: Side; g3: Side }
  matchupOthers?: MatchupOthers
  pace: { averageTurns: number | null; actionsPerTurn: number | null; turn1SpecialSummons: number | null; averageLongestChain: number | null }
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
  turnOrder?: TurnSplit
  sideboarding?: { game1: Side; postSide: Side }
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
    }
  }
}

export type Statistics = {
  season: { id: number; code: string; label: string; ladder: RankedLadderId; startsAt: string; endsAt: string | null }
  syncedDays: { count: number; first: string | null; last: string | null }
  minSamples: number
  totals: { games: number; matches: number; players: number; archetypes: number }
  tierDistribution?: TierDistribution
  rankings?: RankingsSummary
  turnOrder: { all: TurnSplit; game1: TurnSplit; postSide: TurnSplit }
  archetypes: StatArchetype[]
  matchups: Matchup[]
  /** Generic cards in 2+ archetypes, 30 a part, most popular first. */
  mostUsed: { main: MostUsedCard[]; extra: MostUsedCard[] }
  /** Open season only, in the listed archetypes' order. Absent from an older server. */
  sampleDecks?: SampleDeck[]
  metaEvents?: MetaEvent[]
  /** Points are `[seasonDay, metaShare, winRate | null]`, day 1 = opening day. */
  trends: { archetype: ArchetypeKey; name: string | null; points: [number, number, number | null][] }[]
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
export const getStatistics = async ({ ladder, season, ranking }: { ladder: RankedLadderId; season?: string; ranking?: RankingMode }): Promise<StatisticsResult> => {
  const params = new URLSearchParams(season ? { season } : { ladder })
  if (ranking) params.set('ranking', ranking)
  try {
    const res = await fetch(`${API_URL}/statistics?${params}`, { next: { revalidate: 300 } })
    return res.ok ? { ok: true, data: (await res.json()) as Statistics } : { ok: false, status: res.status }
  } catch (error) {
    console.error(error)
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
export type PersonalRecord = {
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
    console.error(error)
    return { ok: false, status: 0 }
  }
}

export const archKey = (a: ArchetypeKey) => a.join('-')

/** `general`: all decks; `pure`: single-archetype decks; `combined`: mixed decks, key `[lead, second]` in that order. */
export type DeepDiveMode = 'general' | 'pure' | 'combined'

/** One searchable archetype of a ranked season. `ready`: in the season build or already calculated. */
export type IndexEntry = { archetype: ArchetypeKey; name: string | null; games: number; ready: boolean }
export type DeepDiveRow = StatArchetype & { rank: number }
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
  (await ok(await fetch(`${API_URL}/statistics/archetypes?${new URLSearchParams({ season, mode })}`, { signal }))).archetypes

/** Always a state, never cached: poll it while `queued` or `running`. */
export const getDeepDive = async (season: string, mode: DeepDiveMode, key: ArchetypeKey, signal?: AbortSignal): Promise<DeepDiveState> =>
  ok(await fetch(`${API_URL}/statistics/archetype?${new URLSearchParams({ season, mode, key: archKey(key) })}`, { cache: 'no-store', signal }))

/** Signed in only (`omega_session`). 429 is the account's hourly limit, not an error. */
export const requestDeepDive = async (season: string, mode: DeepDiveMode, key: ArchetypeKey): Promise<DeepDiveState> => {
  const res = await fetch(`${API_URL}/statistics/archetype`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ season, mode, key: archKey(key) }),
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
export type TierCell = { games: number; players: number }
export type OmegaRange = 7 | 14 | 30
export type OmegaLadder = {
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
  ladders: Record<RankedLadderId, OmegaLadder>
}

/** null when the server can't answer: the page goes on without the section. */
export const getOmegaActivity = async (): Promise<OmegaActivity | null> => {
  try {
    const res = await fetch(`${API_URL}/statistics/omega`, { next: { revalidate: 600 } })
    return res.ok ? ((await res.json()) as OmegaActivity) : null
  } catch (error) {
    console.error(error)
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
