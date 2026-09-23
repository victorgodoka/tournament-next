/**
 * Saved explorations of the duelist analytics page (ANALYTICS_API.md §6). The backend only stores
 * configurations and serves the variable catalog; the numbers are cut on the client (utils/explorer.ts).
 */
import { cache } from 'react'
import { API_URL } from '@utils/auth'
import { AnalyticsApiError, type Duelist, type PlayerSeason } from '@utils/analytics'
import type { Exploration, ExplorationConfig, Variables, Visibility } from './explorer'

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', cache: 'no-store', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new AnalyticsApiError(res.status, body.error, body.message)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

/** `GET /analytics/variables`: constant, cached an hour on both sides. */
export const getVariables = cache(async (): Promise<Variables> => {
  const res = await fetch(`${API_URL}/analytics/variables`, { next: { revalidate: 3600 } })
  if (!res.ok) throw new AnalyticsApiError(res.status)
  return res.json()
})

export type ExplorationList = {
  ownerId: string
  /** The viewer owns them or has `analytics.write`: every visibility, and they may write. */
  editable: boolean
  limit: number
  /** In tab order. Anyone but the owner gets `public` ones only, even on a private profile. */
  explorations: Exploration[]
}

/**
 * `GET /analytics/players/:id/explorations`. On the server, pass the incoming `cookie` so the owner
 * gets every tab and `editable`. `'forbidden'` when the duelist hides it, `null` for 404.
 */
export const getExplorations = cache(async (playerId: string, cookie?: string | null): Promise<ExplorationList | 'forbidden' | null> => {
  try {
    return await request<ExplorationList>(`/analytics/players/${encodeURIComponent(playerId)}/explorations`, cookie ? { headers: { cookie } } : undefined)
  } catch (error) {
    if (error instanceof AnalyticsApiError && error.status === 404) return null
    if (error instanceof AnalyticsApiError && error.status === 403) return 'forbidden'
    throw error
  }
})

export type PublicExploration = Exploration & { owner: Duelist }

/** `GET /analytics/explorations`: every `public` exploration, newest created first, 24 a page. Pass `nextCursor` as `before`. */
export const getPublicExplorations = async (before?: string, cookie?: string | null) =>
  request<{ explorations: PublicExploration[]; nextCursor: string | null }>(
    `/analytics/explorations${before ? `?before=${encodeURIComponent(before)}` : ''}`,
    cookie ? { headers: { cookie } } : undefined,
  )

export type SharedExploration = {
  exploration: Exploration
  owner: Duelist
  /** One key per `config.segments` entry, `current:*` already resolved. `null` = the season was deleted since. */
  seasons: Record<string, PlayerSeason | null>
}

/**
 * `GET /analytics/explorations/shared/:token`: a `link` or `public` exploration with its season data,
 * even when the owner's profile is private. `null` for an unknown token or someone else's `private` one.
 */
export const getSharedExploration = cache(async (token: string, cookie?: string | null): Promise<SharedExploration | null> => {
  try {
    return await request<SharedExploration>(`/analytics/explorations/shared/${encodeURIComponent(token)}`, cookie ? { headers: { cookie } } : undefined)
  } catch (error) {
    if (error instanceof AnalyticsApiError && error.status === 404) return null
    throw error
  }
})

export const sharePath = (token: string) => `/analytics/e/${token}`

/**
 * `POST /analytics/explorations`: goes after the owner's last tab. `visibility` defaults to `private`.
 * `ownerId` defaults to the session's user; another duelist needs `analytics.write` (`403` otherwise).
 * The session's user is always the `author`. `409 LIMIT_REACHED` at the limit.
 */
export const createExploration = (body: { name: string; visibility?: Visibility; config: ExplorationConfig; ownerId?: string }) =>
  request<Exploration>('/analytics/explorations', json('POST', body))

/** `PATCH /analytics/explorations/:id`: a `config` replaces the stored one whole. */
export const updateExploration = (id: string, patch: Partial<Pick<Exploration, 'name' | 'visibility' | 'position' | 'config'>>) =>
  request<Exploration>(`/analytics/explorations/${encodeURIComponent(id)}`, json('PATCH', patch))

/** `DELETE /analytics/explorations/:id` */
export const deleteExploration = (id: string) => request<void>(`/analytics/explorations/${encodeURIComponent(id)}`, { method: 'DELETE' })

/** Copy for a failed write: `message` names the broken rule on a 400. */
export const writeError = (error: unknown) => {
  if (!(error instanceof AnalyticsApiError)) return 'Couldn’t reach the server. Try again in a moment.'
  if (error.status === 401) return 'Your session ended. Sign in again to save.'
  if (error.status === 403) return 'You can’t write explorations on this profile.'
  if (error.code === 'LIMIT_REACHED') return 'You already have the maximum number of explorations. Delete one first.'
  if (error.code === 'INVALID_EXPLORATION') return `The server refused this exploration: ${error.message}`
  return 'Couldn’t save. Try again in a moment.'
}
