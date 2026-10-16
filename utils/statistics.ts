/**
 * The public meta statistics of a ranked season: omega-server-v3 STATISTICS_API.md.
 * Rates are 0–1 fractions, `null` when their denominator is 0; `games` are always deck-games.
 */
import { API_URL } from '@utils/auth'
import type { RankedLadderId } from '@utils/types'

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
  pace: { averageTurns: number; actionsPerTurn: number; turn1SpecialSummons: number; averageLongestChain: number }
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

export type Staple = { id: number; name: string | null; inclusion: number; archetypes: number; playRate: number | null; winRateWhenUsed: number | null }

export type HandTrap = {
  id: number
  name: string | null
  inclusion: number
  activations: number
  respondedRate: number | null
  calledRate: number | null
  crossoutRate: number | null
  /**
   * "Ash'd or Purged": responses that were Ash Blossom or Dominus Purge ÷ responses (not activations).
   * `null` while part of the season predates the counter; it fills in once staff re-sweep the season.
   */
  ashedOrPurgedRate: number | null
  /** Games where it was activated at least once, from the side that activated it. `null` on a partly old season. */
  whenUsed: WhenUsed | null
  targets: {
    archetype: ArchetypeKey
    name: string | null
    activations: number
    respondedRate: number | null
    /** Games where it was used against this deck: the user's win rate in that matchup. */
    whenUsed: WhenUsed | null
  }[]
}

/** Mirrors count in `games`, not in wins/losses. */
export type WhenUsed = { games: number; wins: number; losses: number; draws: number; winRate: number | null; wilsonLower: number | null }

export type Statistics = {
  season: { id: number; code: string; label: string; ladder: RankedLadderId; startsAt: string; endsAt: string | null }
  syncedDays: { count: number; first: string | null; last: string | null }
  minSamples: number
  totals: { games: number; matches: number; players: number; archetypes: number }
  turnOrder: { all: TurnSplit; game1: TurnSplit; postSide: TurnSplit }
  archetypes: StatArchetype[]
  matchups: Matchup[]
  staples: Staple[]
  handTraps: HandTrap[]
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
