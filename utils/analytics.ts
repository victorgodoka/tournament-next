/**
 * Ranked-duel analytics on omega-server-v3 (see its ANALYTICS_API.md). Public, with the session
 * cookie only mattering for private histories.
 *
 * The play log holds summons and activations only: no LP, damage, attacks, targets or outcomes.
 * Never say an effect was negated — only that something was chained to it. `player1` is always the
 * match winner unless it was a draw. Rates are fractions 0–1, and `null` when the denominator is 0.
 */
import { API_URL } from '@utils/auth'
import type { EloPoint } from '@utils/types'

export class AnalyticsApiError extends Error {
  status: number
  /** `NOT_FOUND` or `FORBIDDEN`. Branch on this, never on `message`. */
  code?: string

  constructor(status: number, code?: string, message?: string) {
    super(message ?? `Analytics API failed with ${status}`)
    this.status = status
    this.code = code
  }
}

/* ---------------------------------------------------------------- *
 * Shapes
 * ---------------------------------------------------------------- */

export type Side = 'player1' | 'player2'
export type SideWinner = Side | 'draw' | null

export type Duelist = {
  /** Discord id: a string, never a number. */
  id: string
  displayName: string | null
  username: string | null
  avatar: string | null
}

type AnalyticsMatch = {
  id: string
  ladder: 'tcg' | 'genesys' | null
  start: string | null
  end: string | null
  durationSeconds: number | null
  winner: 'player1' | 'draw' | null
  gamesPlayed: number
  score: { player1: number; player2: number; draws: number }
}

export type EventKind = 'normal_summon' | 'flip_summon' | 'special_summon' | 'card_activated'
export type Phase = 'draw' | 'standby' | 'main1' | 'battle_start' | 'battle_step' | 'damage' | 'damage_cal' | 'battle' | 'main2' | 'end'
type Ownership = 'deck' | 'ambiguous' | 'token' | 'unknown'

export type TimelineEvent = {
  seq: number
  turn: number
  turnPlayer: Side
  /** `null` = a value the API doesn't know: show `phaseCode`. */
  phase: Phase | null
  phaseCode: number
  kind: EventKind | null
  kindCode: number
  /** `id` for the artwork, `canonicalId` for grouping and links. */
  card: { id: number; canonicalId: number; name: string | null; token: boolean }
  /** Whose field it landed on. */
  controller: Side
  /** Who played it. `null` for tokens and unknown cards. */
  owner: Side | null
  ownership: Ownership
  /** `null` = not part of a chain (summons). */
  chain: { id: number; link: number; respondsTo: number | null } | null
}

export type TimelineGame = {
  gameNumber: number
  firstPlayer: Side
  winner: SideWinner
  /** Raw, meaning unconfirmed: never label it. */
  endReasonCode: number | null
  turns: number
  events: TimelineEvent[]
}

export type MatchTimeline = {
  match: AnalyticsMatch
  players: Record<Side, Duelist & { archetype: string | null; deck: { name: string | null } | null }>
  games: TimelineGame[]
}

type CardUse = { cardId: number; name: string | null }

type GamePlayerStats = {
  archetype: string | null
  actions: number
  comboLength: { turns: number; average: number } | null
  cards: (CardUse & { token: boolean; activations: number; normalSummons: number; specialSummons: number; flipSummons: number; total: number })[]
  mostUsed: (CardUse & { uses: number })[]
  deckCoverage: Record<'main' | 'extra', { used: number; total: number; rate: number | null }>
  sideCardsUsed: CardUse[]
}

export type GameStats = {
  gameNumber: number
  firstPlayer: Side
  winner: SideWinner
  endReasonCode: number | null
  turns: number
  totalActions: number
  longestChain: number
  /** Summons, not what stayed on the field — never call it a board. */
  turn1SpecialSummons: number
  perTurn: {
    turn: number
    turnPlayer: Side
    actions: number
    turnPlayerActions: number
    opponentActions: number
    specialSummons: number
    longestChain: number
  }[]
  handTraps: (CardUse & {
    seq: number
    turn: number
    player: Side
    link: number
    chainedTo: (CardUse & { seq: number; controller: Side; kind: EventKind | null }) | null
  })[]
  players: Record<Side, GamePlayerStats>
}

export type MatchStats = {
  match: AnalyticsMatch
  players: Record<Side, Duelist & { archetype: string | null; deckName: string | null }>
  games: GameStats[]
}


type Record3 ={ games: number; wins: number; losses: number; draws: number; winRate: number | null }
type Share = { games: number; rate: number | null }

type ResponseSplit = {
  activations: number
  responded: number
  respondedRate: number | null
  calledByTheGrave: number
  /** Of responses, not of activations. */
  calledByTheGraveRate: number | null
  crossoutDesignator: number
  crossoutDesignatorRate: number | null
  /** "Ash'd or Purged": responses that were Ash Blossom or Dominus Purge. */
  ashedOrPurged: number
  /** Of responses. `null` while part of the season predates the counter (fills in after a re-sweep). */
  ashedOrPurgedRate: number | null
}

export type PlayerSeason = {
  /** `analyticsOnly` = a panel period, not a ranked season: no standing, no Elo. */
  season: { id: number; code: string; label: string; ladder: 'tcg' | 'genesys'; startsAt: string; endsAt: string | null; analyticsOnly?: boolean }
  player: Duelist
  /** Over 1000 matches: only the newest 1000 were analyzed. */
  truncated?: boolean
  /** The duelist's row in the ladder snapshot; `null` = no row this season. Open season: up to 24 h old. */
  standing: {
    elo: number
    rank: number
    wins: number
    loses: number
    draws: number
    recent: string | null
    topDeck: { name: string; artCardId: number } | null
    topDeckMeta: { duels: number; wins: number } | null
    syncedAt: string
  } | null
  /** One point per recorded day, oldest first. Days with no sync have no point: never fill them. */
  eloHistory: EloPoint[]
  gameCount: number
  matchCount: number
  record: Record3
  archetypeDistribution: (Record3 & { archetype: string | null; share: number })[]
  firstVsSecond: { archetype: string | null; first: Record3; second: Record3 }[]
  comboLength: { archetype: string | null; turns: number; actions: number; average: number | null }[]
  averageDeckCoverage: { main: number | null; extra: number | null } | null
  cardUsage: (CardUse & {
    deckInclusion: Share
    usage: Share
    /** Every game with the card in the deck, used or not. All zeros on a season not swept since this field. */
    whenInDeck: Record3
    /** Games where it was used (summoned or activated). Activations only on a season not swept since. */
    whenUsed: Record3
    byArchetype: { archetype: string | null; games: number; deckInclusion: Share; usage: Share; whenInDeck: Record3; whenUsed: Record3 }[]
  })[]
  responses: (CardUse & { byPlayer: ResponseSplit; byOpponent: ResponseSplit })[]
  handTrapsPerMatchup: {
    archetype: string | null
    opponentArchetype: string | null
    games: number
    handTraps: (CardUse & Record<'player' | 'opponent', { activations: number; games: number; perGame: number | null }>)[]
  }[]
  mostUsedCardsPerArchetype: { archetype: string | null; cards: (CardUse & { uses: number; games: number })[] }[]
  games: {
    matchId: string
    gameNumber: number
    start: string | null
    archetype: string | null
    opponentId: string | null
    opponentArchetype: string | null
    wentFirst: boolean | null
    result: 'win' | 'loss' | 'draw' | null
    turns: number
    actions: number
    /* Per-game detail. All `null` on a game stored before it existed (counted in `gamesWithoutDetail`). */
    combo: { turns: number; actions: number; average: number | null } | null
    deckCoverage: { main: number | null; extra: number | null } | null
    /** By whoever went first. Summons, not a board. */
    turn1SpecialSummons: number | null
    longestChain: number | null
    /** Canonical ids. Names are in `cardUsage[].name`. */
    cards: { used: { cardId: number; uses: number }[]; activated: number[] } | null
    /** Tracked hand-trap ids, one entry per activation. Names are in `responses[].name`. */
    handTraps: { player: number[]; opponent: number[] } | null
  }[]
  /** Games whose detail is `null`: a metric that needs it covers `gameCount - gamesWithoutDetail`. */
  gamesWithoutDetail: number
  opponents: Record<string, Duelist>
}

/* ---------------------------------------------------------------- *
 * Transport
 * ---------------------------------------------------------------- */

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', cache: 'no-store', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new AnalyticsApiError(res.status, body.error, body.message)
  }
  return res.json()
}

/** Profile match ids are `ranked:<n>`; the analytics endpoints take the bare number. */
export const analyticsMatchId = (id: string) => id.replace(/^ranked:/, '')

export const getMatchTimeline = (matchId: string, signal?: AbortSignal) =>
  request<MatchTimeline>(`/analytics/matches/${encodeURIComponent(analyticsMatchId(matchId))}/timeline`, { signal })

export const getMatchStats = (matchId: string, signal?: AbortSignal) =>
  request<MatchStats>(`/analytics/matches/${encodeURIComponent(analyticsMatchId(matchId))}/stats`, { signal })

/* ---------------------------------------------------------------- *
 * Labels
 * ---------------------------------------------------------------- */

export const KIND_LABEL: Record<EventKind, string> = {
  normal_summon: 'Normal Summon',
  flip_summon: 'Flip Summon',
  special_summon: 'Special Summon',
  card_activated: 'Activated',
}

export const PHASE_LABEL: Record<Phase, string> = {
  draw: 'Draw Phase',
  standby: 'Standby Phase',
  main1: 'Main Phase 1',
  battle_start: 'Battle Phase (start step)',
  battle_step: 'Battle Step',
  damage: 'Damage Step',
  damage_cal: 'Damage Calculation',
  battle: 'Battle Phase (end step)',
  main2: 'Main Phase 2',
  end: 'End Phase',
}

/** `0.5263` → `53%`. `null` (no denominator) is a dash, never `0%`. */
export const pct = (rate: number | null | undefined) => (rate === null || rate === undefined ? '—' : `${Math.round(rate * 100)}%`)

export const archetypeName = (archetype: string | null) => archetype ?? 'Unknown'

export const duelistName = (duelist: Pick<Duelist, 'displayName' | 'username'> | undefined) =>
  duelist?.displayName ?? duelist?.username ?? 'Unknown duelist'
