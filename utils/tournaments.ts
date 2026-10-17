/**
 * Tournament endpoints on omega-server-v3 (see its TOURNAMENT_API.md).
 * Public read-only GETs, except pre-registration on a scheduled tournament (session cookie).
 */
import { cache } from 'react'
import { API_URL } from '@utils/auth'
import type {
  CalendarEntry,
  PlayerTournamentPage,
  ScheduledTournament,
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

/** Every tournament starting in [from, to): played, live and scheduled. At most 31 days. */
export const getCalendar = (from: Date, to: Date, signal?: AbortSignal) =>
  get<{ from: string; to: string; entries: CalendarEntry[] }>(
    `/calendar${search({ from: from.toISOString(), to: to.toISOString() })}`,
    15,
    signal,
  )

/**
 * The page of a calendar entry. Built here rather than read from the API's `url`, which points
 * game tournaments at `/tournaments/{id}` while this site serves them at `/tournament/{id}`.
 */
export const calendarHref = ({ source, id }: Pick<CalendarEntry, 'source' | 'id'>): string | null =>
  id === null ? null : source === 'omega' ? `/tournament/${id}` : source === 'panel' ? `/tournaments/scheduled/${id}` : null

/**
 * A staff-scheduled tournament and its pre-registrations. Rendered on the server with the
 * visitor's cookie, so `registration.registered` says whether *they* signed up. `null` for an unknown id.
 */
export const getScheduled = cache(async (id: string, cookie: string | null): Promise<ScheduledTournament | null> => {
  const res = await fetch(`${API_URL}/tournaments/scheduled/${encodeURIComponent(id)}`, {
    headers: cookie ? { cookie } : undefined,
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new TournamentApiError(res.status, body.error, body.message)
  }
  return res.json()
})

/**
 * Pre-register (`true`) or withdraw (`false`). Idempotent; returns the page's new state.
 * `401` without a session, `409 REGISTRATION_CLOSED` once it started or was linked.
 */
export const setRegistration = async (id: number, registered: boolean): Promise<ScheduledTournament> => {
  const res = await fetch(`${API_URL}/tournaments/scheduled/${id}/registration`, {
    method: registered ? 'POST' : 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new TournamentApiError(res.status, body.error, body.message)
  }
  return res.json()
}
