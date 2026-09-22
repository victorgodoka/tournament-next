/**
 * Tournament endpoints on omega-server-v3 (see its TOURNAMENT_API.md).
 * Everything is a public read-only GET: no session, no cookie to forward.
 */
import { cache } from 'react'
import { API_URL } from '@utils/auth'
import type {
  PlayerTournamentPage,
  TournamentDetail,
  TournamentPage,
  TournamentStatus,
  TournamentsStats,
} from '@utils/types'

export class TournamentApiError extends Error {
  status: number
  /** Stable code (`BAD_REQUEST`, `NOT_FOUND`). Branch on this, never on `message`. */
  code?: string

  constructor(status: number, code?: string, message?: string) {
    super(message ?? `Tournament API failed with ${status}`)
    this.status = status
    this.code = code
  }
}

const search = (query: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** `revalidate` mirrors the endpoint's own `Cache-Control`; it is ignored on client-side calls. */
const get = async <T>(path: string, revalidate: number, signal?: AbortSignal): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate }, signal })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new TournamentApiError(res.status, body.error, body.message)
  }
  return res.json()
}

/**
 * Newest first, live and finished mixed unless `status` narrows it.
 * Pass `nextCursor` back as `cursor` with the **same** filters for the next page.
 */
export const listTournaments = (
  query: { status?: TournamentStatus; banlist?: string; limit?: number; cursor?: string } = {},
  signal?: AbortSignal,
) => get<TournamentPage>(`/tournaments${search(query)}`, 15, signal)

/** The whole tournament page in one call. `null` for an unknown or malformed id. */
export const getTournament = cache(async (id: string): Promise<TournamentDetail | null> => {
  try {
    return await get<TournamentDetail>(`/tournaments/${encodeURIComponent(id)}`, 15)
  } catch (error) {
    if (error instanceof TournamentApiError && error.status === 404) return null
    throw error
  }
})

/**
 * Every tournament a duelist entered, newest first, with only their standing and decklist.
 * The profile already carries the 3 latest, so this backs "see all".
 */
export const listPlayerTournaments = (
  id: string,
  query: { limit?: number; cursor?: string } = {},
  signal?: AbortSignal,
) => get<PlayerTournamentPage>(`/tournaments/players/${encodeURIComponent(id)}${search(query)}`, 15, signal)

/**
 * Aggregates across finished tournaments. The first uncached call takes seconds, so this is
 * read after hydration rather than on the server render path.
 */
export const getTournamentsStats = (
  query: { banlist?: string; from?: string; to?: string } = {},
  signal?: AbortSignal,
) => get<TournamentsStats>(`/tournaments/stats${search(query)}`, 300, signal)
