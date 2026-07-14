import type { Tournament } from '../tournament/tournament.types'

export function isTournamentCompleted(tournament: Pick<Tournament, 'endtime'>): boolean {
  return Boolean(tournament.endtime)
}

export function getTournamentStatusLabel(tournament: Pick<Tournament, 'endtime'>): string {
  return isTournamentCompleted(tournament) ? 'Completed' : 'Live'
}

export function getTournamentStatusModifier(tournament: Pick<Tournament, 'endtime'>): string {
  return isTournamentCompleted(tournament)
    ? 'history-card__status--completed'
    : 'history-card__status--live'
}

export function formatTournamentDate(starttime: string): string {
  const date = new Date(starttime)
  if (Number.isNaN(date.getTime())) return 'Unknown date'

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export function formatTournamentRounds(phases: number): string {
  return `${phases} ${phases === 1 ? 'Round' : 'Rounds'}`
}
