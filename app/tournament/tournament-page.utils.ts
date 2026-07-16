import type {
  Duel,
  Round,
  Tournament,
  TournamentSettings,
  TournamentUser,
} from './tournament.types'
import { decodeDuelData } from './tournament.utils'

export const MAX_VISIBLE_PLAYERS = 7

export function isTournamentFinished(
  tournament: Pick<Tournament, 'endtime'>,
): boolean {
  if (!tournament.endtime) return false
  const endtime = new Date(tournament.endtime).getTime()
  if (Number.isNaN(endtime)) return false
  return endtime <= Date.now()
}

export function parseTournamentSettings(
  settings: number,
): TournamentSettings | null {
  if (!Number.isFinite(settings)) return null
  return decodeDuelData(settings)
}

export function formatTournamentDateTime(
  value: string | null | undefined,
): string {
  if (!value) return 'TBD'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'TBD'

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function buildUserMap(users: TournamentUser[]): Map<string, TournamentUser> {
  return new Map(users.map((user) => [user.user_id, user]))
}

export function getUserDisplayName(
  user: { displayname?: string; username?: string } | undefined,
): string {
  return user?.displayname || user?.username || 'Unknown Duelist'
}

export function sortRoundsDescending(rounds: Round[]): Round[] {
  return [...rounds].sort((a, b) => b.phase - a.phase)
}

export function getVisiblePlayers(
  users: TournamentUser[],
  max: number = MAX_VISIBLE_PLAYERS,
): TournamentUser[] {
  return users.slice(0, max)
}

export function getOverflowPlayerCount(
  users: TournamentUser[],
  max: number = MAX_VISIBLE_PLAYERS,
): number {
  return Math.max(users.length - max, 0)
}

export type DuelOutcome =
  | { status: 'ongoing' }
  | { status: 'completed'; winnerId: string; loserId: string }

export function getDuelOutcome(duel: Duel): DuelOutcome {
  if (!duel.winner) return { status: 'ongoing' }

  const loserId = duel.winner === duel.duelist1 ? duel.duelist2 : duel.duelist1
  return { status: 'completed', winnerId: duel.winner, loserId }
}
