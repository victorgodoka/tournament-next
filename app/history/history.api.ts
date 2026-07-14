import { API_ENDPOINTS } from "@const";
import { apiFailure, ApiResult, apiSuccess } from "@lib/api-result";
import { TournamentGetProps, TournamentsListResponse } from "./history.types";

export const getTournaments = async ({ page = 1, limit = 20 }: TournamentGetProps): Promise<ApiResult<TournamentsListResponse>> => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append("page", page.toString());
    queryParams.append("limit", limit.toString());
    const url = `${API_ENDPOINTS.DUELISTS_UNITE_V3}/tournaments?${queryParams.toString()}`
    const response = await fetch(url)
    if (!response.ok) {
      return apiFailure('Failed to fetch player customization data')
    }

    const data: TournamentsListResponse = await response.json()
    return apiSuccess(data)
  }
  catch (error) {
    console.error("Get Tournaments Error:", error);
    return apiFailure(
      error instanceof Error
        ? error.message
        : 'Failed to fetch player customization data',
    )
  }
}