import { API_ENDPOINTS } from '@const'
import { apiFailure, apiSuccess, type ApiResult } from '@lib/api-result'
import { LEADERBOARD_REVALIDATE_SECONDS } from './leaderboards.const'
import type { LeaderboardData } from './leaderboards.types'
import { parseLeaderboardsResponse } from './leaderboards.validation'

export async function getLeaderboard(): Promise<ApiResult<LeaderboardData>> {
  try {
    const response = await fetch(`${API_ENDPOINTS.MAIN}/leaderboard`, {
      next: { revalidate: LEADERBOARD_REVALIDATE_SECONDS },
    })

    if (!response.ok) {
      return apiFailure('Failed to fetch leaderboard data')
    }

    const body: unknown = await response.json()
    const data = parseLeaderboardsResponse(body)

    if (!data) {
      return apiFailure('Invalid leaderboard response')
    }

    return apiSuccess(data)
  } catch (error) {
    return apiFailure(
      error instanceof Error ? error.message : 'Failed to fetch leaderboard data',
    )
  }
}
