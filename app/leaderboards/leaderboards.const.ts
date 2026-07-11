export const LEADERBOARD_TOP_COUNT = 50

export const LEADERBOARD_REVALIDATE_SECONDS = 300

export type LeaderboardMode = 'TCG' | 'Genesys'

export const LEADERBOARD_MODES: Array<{ id: LeaderboardMode; label: string }> = [
  { id: 'TCG', label: 'TCG' },
  { id: 'Genesys', label: 'Genesys' },
]

export const LEADERBOARD_BADGE_BASE: Record<LeaderboardMode, string> = {
  TCG: '/badges/TCG',
  Genesys: '/badges/OCG',
}
