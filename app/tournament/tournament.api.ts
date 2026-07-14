import { API_ENDPOINTS } from '@const'
import { TournamentDetailResponse } from "./tournament.types";
import { apiFailure, ApiResult, apiSuccess } from '@lib/api-result';

export const getLiveTournament = async (): Promise<ApiResult<TournamentDetailResponse>> => {
  try {
    const url = `${API_ENDPOINTS.DUELISTS_UNITE_V3}/tournaments/live`
    const response = await fetch(url)
    if (!response.ok) {
      return apiFailure('Failed to fetch tournament data')
    }

    const data: TournamentDetailResponse = await response.json()
    return apiSuccess(data)
  }
  catch (error) {
    console.error("Get Tournaments Error:", error);
    return apiFailure(
      error instanceof Error
        ? error.message
        : 'Failed to fetch tournament data',
    )
  }
}

export const getTournamentByID = async (id: number): Promise<ApiResult<TournamentDetailResponse>> => {
  if (!id) return apiFailure('Invalid tournament ID.')
  try {
    const url = `${API_ENDPOINTS.DUELISTS_UNITE_V3}/tournaments/${id}`
    const response = await fetch(url)
    if (!response.ok) {
      return apiFailure('Failed to fetch tournament data')
    }

    const data: TournamentDetailResponse = await response.json()
    return apiSuccess(data)
  }
  catch (error) {
    console.error("Get Tournaments Error:", error);
    return apiFailure(
      error instanceof Error
        ? error.message
        : 'Failed to fetch tournament data',
    )
  }
}
