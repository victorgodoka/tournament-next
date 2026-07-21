import { API_ENDPOINTS } from '@const'
import { fetchJson } from '@lib/api-fetch'
import type { ApiResult } from '@lib/api-result'
import { LEADERBOARD_REVALIDATE_SECONDS } from './leaderboards.const'
import type { LeaderboardData } from './leaderboards.types'
import { parseLeaderboardsResponse } from './leaderboards.validation'

export const getLeaderboard = (): Promise<ApiResult<LeaderboardData>> =>
  fetchJson(`${API_ENDPOINTS.MAIN}/leaderboard`, {
    revalidate: LEADERBOARD_REVALIDATE_SECONDS,
    parse: parseLeaderboardsResponse,
    errorMessage: 'Failed to fetch leaderboard data',
  })
