/**
 * Ranked-duel analytics on omega-server-v3 (see its ANALYTICS_API.md). Public, with the session
 * cookie only mattering for private histories.
 *
 * The play log holds summons and activations only: no LP, damage, attacks, targets or outcomes.
 * Never say an effect was negated — only that something was chained to it. `player1` is always the
 * match winner unless it was a draw. Rates are fractions 0–1, and `null` when the denominator is 0.
 */
import { API_URL } from '@utils/auth'

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
  /** The staff's staples list, one entry per activation. `player` is `null` when the log could not attribute it. */
  staples: (CardUse & {
    seq: number
    turn: number
    player: Side | null
    link: number
    chainedTo: (CardUse & { seq: number; controller: Side | null; kind: EventKind | null }) | null
  })[]
  players: Record<Side, GamePlayerStats>
}

export type MatchStats = {
  match: AnalyticsMatch
  players: Record<Side, Duelist & { archetype: string | null; deckName: string | null }>
  games: GameStats[]
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
