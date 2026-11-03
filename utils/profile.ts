/**
 * Profile endpoints on omega-server-v3 (see its PROFILE_API.md).
 * Reads work anonymously; with the session they return what this viewer may see.
 */
import { cache } from 'react'
import { API_URL } from '@utils/auth'
import type { DeckStats, MatchPage, Profile, ProfileSettings, ProfileSettingsPatch } from '@utils/types'

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
export const getProfile = cache(async (id: string, cookie?: string | null, limit?: number, asVisitor?: boolean): Promise<Profile | null> => {
  const params = new URLSearchParams()
  if (limit) params.set('limit', String(limit))
  if (asVisitor) params.set('as', 'visitor')
  const query = params.size ? `?${params}` : ''
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
  { cursor, format, season, asVisitor, limit = MATCH_PAGE_SIZE }: { cursor?: string; format?: MatchFormat; season?: string; asVisitor?: boolean; limit?: number } = {},
  signal?: AbortSignal,
) => {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  if (format) params.set('ladder', format)
  if (season) params.set('season', season)
  if (asVisitor) params.set('as', 'visitor')
  return request<MatchPage>(`/profiles/${encodeURIComponent(id)}/matches?${params}`, { signal })
}

/** "Decks this season". `403 DECKS_HIDDEN` unless `view.deckStats`. */
export const getDeckStats = (id: string, asVisitor?: boolean) =>
  request<DeckStats>(`/profiles/${encodeURIComponent(id)}/decks${asVisitor ? '?as=visitor' : ''}`)

/** Signs one direct upload of a cover to Cloudinary (VIP). */
export const signCoverUpload = () =>
  request<{ uploadUrl: string; fields: Record<string, string | number> }>('/profiles/me/cover/sign', { method: 'POST' })

/** Sign, upload straight to Cloudinary, then the caller PATCHes `coverImageId` with the returned id. */
export const uploadCover = async (file: File): Promise<string> => {
  const { uploadUrl, fields } = await signCoverUpload()
  const body = new FormData()
  for (const [key, value] of Object.entries(fields)) body.append(key, String(value))
  body.append('file', file)
  const res = await fetch(uploadUrl, { method: 'POST', body })
  if (!res.ok) throw new ProfileApiError(res.status, 'UPLOAD_FAILED')
  return String(fields.public_id)
}

/** The cover limit the API enforces (`422 TOO_LARGE`), checked first so nothing big is uploaded. */
export const COVER_MAX_BYTES = 2 * 1024 * 1024

/** Send changed fields only. Render from the result: the server normalizes what it saves. */
export const updateProfile = (patch: ProfileSettingsPatch) =>
  request<ProfileSettings>('/profiles/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })

