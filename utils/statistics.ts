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

export type StatCard = {
  id: number
  name: string | null
  inclusion: number
  averageCopies: number
  playRate: number | null
  /** `null` when part of the season was recorded the old way: "not enough data". */
  winRateWhenUsed: number | null
  winRateInDeck: number | null
}

/** `cards`: every card of the group seen in the archetype. Absent from a server older than the field. */
export type CardGroup = { id: number; name: string; inclusion: number; winRate: number | null; cards?: StatCard[] }

export type StatArchetype = {
  archetype: ArchetypeKey
  name: string | null
  games: number
  metaShare: number
  wins: number
  losses: number
  draws: number
  winRate: number | null
  wilsonLower: number | null
  mirrorShare: number
  players: number
  turnOrder: TurnSplit
  sideboarding: { game1: Side; postSide: Side }
  pace: { averageTurns: number | null; actionsPerTurn: number | null; turn1SpecialSummons: number | null; averageLongestChain: number | null }
  cards: StatCard[]
  engines: CardGroup[]
  techs: CardGroup[]
}

export type Matchup = {
  archetype: ArchetypeKey
  opponent: ArchetypeKey
  games: number
  wins: number
  losses: number
  draws: number
  winRate: number | null
  wilsonLower: number | null
}

/** Rates are 0–1; `null` is "not enough data" (days swept before the counters, or no denominator). */
export type MostUsedCard = {
  id: number
  name: string | null
  handTrap: boolean
  popularity: number
  usageRate: number | null
  winRateWhenUsed: number | null
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
  turnOrder: { all: TurnSplit; game1: TurnSplit; postSide: TurnSplit }
  archetypes: StatArchetype[]
  matchups: Matchup[]
  /** Generic cards in 2+ archetypes, 30 a part, most popular first. */
  mostUsed: { main: MostUsedCard[]; extra: MostUsedCard[] }
  /** Points are `[seasonDay, metaShare, winRate | null]`, day 1 = opening day. */
  trends: { archetype: ArchetypeKey; name: string | null; points: [number, number, number | null][] }[]
}

export type StatisticsResult = { ok: true; data: Statistics } | { ok: false; status: number }

/**
 * `season` (a code) wins over `ladder` server-side, so only one is sent. Cached 5 minutes like the
 * endpoint; a network failure comes back as status 0.
 */
export const getStatistics = async ({ ladder, season }: { ladder: RankedLadderId; season?: string }): Promise<StatisticsResult> => {
  const params = new URLSearchParams(season ? { season } : { ladder })
  try {
    const res = await fetch(`${API_URL}/statistics?${params}`, { next: { revalidate: 300 } })
    return res.ok ? { ok: true, data: (await res.json()) as Statistics } : { ok: false, status: res.status }
  } catch (error) {
    console.error(error)
    return { ok: false, status: 0 }
  }
}

export const archKey = (a: ArchetypeKey) => a.join('-')

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

/** Every searchable archetype, most played first. */
export const getArchetypeIndex = async (season: string, signal?: AbortSignal): Promise<IndexEntry[]> =>
  (await ok(await fetch(`${API_URL}/statistics/archetypes?${new URLSearchParams({ season })}`, { signal }))).archetypes

/** Always a state, never cached: poll it while `queued` or `running`. */
export const getDeepDive = async (season: string, key: ArchetypeKey, signal?: AbortSignal): Promise<DeepDiveState> =>
  ok(await fetch(`${API_URL}/statistics/archetype?${new URLSearchParams({ season, key: archKey(key) })}`, { cache: 'no-store', signal }))

/** Signed in only (`omega_session`). 429 is the account's hourly limit, not an error. */
export const requestDeepDive = async (season: string, key: ArchetypeKey): Promise<DeepDiveState> => {
  const res = await fetch(`${API_URL}/statistics/archetype`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ season, key: archKey(key) }),
  })
  /* The IP limiter answers 429 too, without a `retryAt`. */
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
