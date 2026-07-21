import { API_ENDPOINTS } from "@const";
import { fetchJson } from "@lib/api-fetch";
import { isRecord, type ApiResult } from "@lib/api-result";
import { TournamentGetProps, TournamentsListResponse } from "./history.types";

/** Envelope + list/pagination shape; tournament entries are narrowed once
 * and consumed defensively by the listing UI. */
function parseTournamentsListResponse(body: unknown): TournamentsListResponse | null {
  if (!isRecord(body) || !isRecord(body.data)) return null
  if (!Array.isArray(body.data.tournaments) || !isRecord(body.data.pagination)) return null
  return body as unknown as TournamentsListResponse
}

export const getTournaments = ({ page = 1, limit = 20 }: TournamentGetProps): Promise<ApiResult<TournamentsListResponse>> => {
  const queryParams = new URLSearchParams({ page: String(page), limit: String(limit) })

  return fetchJson(`${API_ENDPOINTS.MAIN}/tournaments?${queryParams}`, {
    parse: parseTournamentsListResponse,
    errorMessage: 'Failed to fetch tournament history',
  })
}
