import { API_ENDPOINTS } from '@const'
import { fetchJson } from '@lib/api-fetch'
import { apiFailure, isRecord, type ApiResult } from '@lib/api-result'
import { TournamentDetail, TournamentDetailResponse } from "./tournament.types";

// Cache tournament fetches for 5 minutes. Ongoing tournaments expose a hard
// refresh button (which revalidates this path); ended tournaments never change.
const TOURNAMENT_REVALIDATE_SECONDS = 5 * 60

/** Checks the envelope and the top-level detail collections; the deeply
 * nested duel/user entries are narrowed once and consumed defensively. */
function parseTournamentDetailResponse(body: unknown): TournamentDetailResponse | null {
  if (!isRecord(body) || typeof body.success !== 'boolean') return null

  const data =
    isRecord(body.data) &&
    isRecord(body.data.tournament) &&
    Array.isArray(body.data.rounds) &&
    Array.isArray(body.data.users)
      ? (body.data as unknown as TournamentDetail)
      : undefined

  return { success: body.success, data }
}

const getTournament = (url: string): Promise<ApiResult<TournamentDetailResponse>> =>
  fetchJson(url, {
    revalidate: TOURNAMENT_REVALIDATE_SECONDS,
    parse: parseTournamentDetailResponse,
    errorMessage: 'Failed to fetch tournament data',
  })

export const getLiveTournament = (): Promise<ApiResult<TournamentDetailResponse>> =>
  getTournament(`${API_ENDPOINTS.MAIN}/tournaments/live`)

export const getTournamentByID = (id: number): Promise<ApiResult<TournamentDetailResponse>> => {
  if (!id) return Promise.resolve(apiFailure('Invalid tournament ID.'))
  return getTournament(`${API_ENDPOINTS.MAIN}/tournaments/${id}`)
}
