import { calculateWinRate, getTierInfo } from '../profile/profile.utils'
import {
  LEADERBOARD_BADGE_BASE,
  LEADERBOARD_TOP_COUNT,
  type LeaderboardMode,
} from './leaderboards.const'
import type { PlayerStats } from './leaderboards.types'

export function getLeaderboardTierInfo(rating: number, mode: LeaderboardMode) {
  const tier = getTierInfo(rating)
  const badgeBase = LEADERBOARD_BADGE_BASE[mode]
  const slug = tier.name.toLowerCase()

  return {
    ...tier,
    accentClass: `leaderboards__tier--${slug}`,
    image: `${badgeBase}/${slug}.png`,
  }
}

export function getPlayerDisplayName(player: PlayerStats): string {
  const name = player.displayname.trim()
  return name || player.username
}

export function formatLeaderboardRating(rating: number): string {
  return Math.round(rating).toLocaleString()
}

export function formatLeaderboardRecord(
  wins: number,
  losses: number,
  draws: number,
): string {
  if (draws > 0) return `${wins}W · ${losses}L · ${draws}D`
  return `${wins}W · ${losses}L`
}

export function formatLeaderboardWinRate(
  wins: number,
  losses: number,
  draws = 0,
): string {
  return `${calculateWinRate(wins, losses, draws).toFixed(1)}%`
}

export function getLeaderboardWinRateClass(
  wins: number,
  losses: number,
  draws = 0,
): string {
  const winRate = calculateWinRate(wins, losses, draws)
  if (winRate >= 70) return 'leaderboards__win-rate--excellent'
  if (winRate >= 55) return 'leaderboards__win-rate--good'
  if (winRate >= 45) return 'leaderboards__win-rate--average'
  return 'leaderboards__win-rate--low'
}

export function getLeaderboardRankModifier(rank: number): string {
  if (rank === 1) return 'leaderboards__row--champion'
  if (rank >= 2 && rank <= 4) return 'leaderboards__row--podium'
  return ''
}

export function getLeaderboardRankIcon(rank: number): string | null {
  if (rank === 1) return 'mdi:crown'
  if (rank === 2) return 'mdi:medal'
  if (rank === 3) return 'mdi:medal-outline'
  if (rank === 4) return 'mdi:star-four-points'
  return null
}

export function sliceTopPlayers(players: PlayerStats[]): PlayerStats[] {
  return players.slice(0, LEADERBOARD_TOP_COUNT)
}
