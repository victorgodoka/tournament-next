import { isRecord } from '@lib/api-result'
import type { LeaderboardData, PlayerStats } from './leaderboards.types'

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizePlayerStats(value: unknown): PlayerStats | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.username !== 'string') return null
  if (typeof value.displayname !== 'string') return null
  if (!isNumber(value.wins) || !isNumber(value.loses) || !isNumber(value.draws)) return null
  if (!isNumber(value.rating) || !isNumber(value.games)) return null
  if (!isNumber(value.winstreak) || !isNumber(value.losestreak)) return null
  if (typeof value.ot !== 'string') return null

  return {
    id: value.id,
    username: value.username,
    avatar: typeof value.avatar === 'string' ? value.avatar : undefined,
    displayname: value.displayname,
    wins: value.wins,
    loses: value.loses,
    draws: value.draws,
    rating: value.rating,
    winstreak: value.winstreak,
    losestreak: value.losestreak,
    games: value.games,
    ot: value.ot,
  }
}

function normalizePlayerList(value: unknown): PlayerStats[] | null {
  if (!Array.isArray(value)) return null

  return value
    .map(normalizePlayerStats)
    .filter((player): player is PlayerStats => player !== null)
}

export function parseLeaderboardsResponse(body: unknown): LeaderboardData | null {
  if (!isRecord(body) || body.success !== true) return null
  if (!isRecord(body.data)) return null

  const tcg = normalizePlayerList(body.data.TCG)
  const genesysSource = body.data.Genesys ?? body.data.OCG
  const genesys = normalizePlayerList(genesysSource)

  if (!tcg || !genesys) return null

  return { TCG: tcg, Genesys: genesys }
}
