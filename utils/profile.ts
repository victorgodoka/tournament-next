/**
 * Profile endpoints on omega-server-v3 (see its PROFILE_API.md).
 * Reads work anonymously; with the session they return what this viewer may see.
 */
import { cache } from 'react'
import { API_URL } from '@utils/auth'
import type { MatchPage, Profile, ProfileSettings, ProfileSettingsPatch } from '@utils/types'

export class ProfileApiError extends Error {
  status: number
  /** Stable code (`FORBIDDEN`, `NOT_CONFIGURED`, ...). Branch on this, never on `message`. */
  code?: string

  constructor(status: number, code?: string, message?: string) {
    super(message ?? `Profile API failed with ${status}`)
    this.status = status
    this.code = code
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', cache: 'no-store', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ProfileApiError(res.status, body.error, body.message)
  }
  return res.json()
}

/** Duels per page. The API defaults to 6 and caps at 50; one ledger screen is worth more than 6. */
export const MATCH_PAGE_SIZE = 20

/** One ranked ladder. Omit for both. History is ranked only: there is no casual room. */
export type MatchFormat = 'tcg' | 'genesys'

/**
 * `null` for an unknown or malformed id, anything else unexpected throws.
 * On the server, pass the incoming `cookie` header so the API sees the viewer's session.
 * `limit` stays a plain number so `cache` still dedupes the metadata and the render call.
 */
export const getProfile = cache(async (id: string, cookie?: string | null, limit?: number): Promise<Profile | null> => {
  const query = limit ? `?limit=${limit}` : ''
  try {
    return await request<Profile>(`/profiles/${encodeURIComponent(id)}${query}`, cookie ? { headers: { cookie } } : undefined)
  } catch (error) {
    if (error instanceof ProfileApiError && error.status === 404) return null
    throw error
  }
})

/**
 * Older duels. A `403` means the profile turned private for this viewer: re-fetch the profile.
 * Keep `format` identical across a cursor walk — the pages of one walk must all use the same filter.
 */
export const getMatches = (
  id: string,
  { cursor, format, limit = MATCH_PAGE_SIZE }: { cursor?: string; format?: MatchFormat; limit?: number } = {},
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  if (format) params.set('ladder', format)
  return request<MatchPage>(`/profiles/${encodeURIComponent(id)}/matches?${params}`, { signal })
}

/** Send changed fields only. Render from the result: the server normalizes what it saves. */
export const updateProfile = (patch: ProfileSettingsPatch) =>
  request<ProfileSettings>('/profiles/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })

