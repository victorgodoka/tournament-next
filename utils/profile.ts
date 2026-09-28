/**
 * Profile endpoints on omega-server-v3 (see its PROFILE_API.md).
 * Reads work anonymously; with the session they return what this viewer may see.
 */
import { cache } from 'react'
import { API_URL, getMeServer } from '@utils/auth'
import type { MatchPage, Profile, ProfileSettings, ProfileSettingsPatch, SelfProfile } from '@utils/types'

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

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

/**
 * Cloudinary does the resizing and format choice on its own CDN, so covers skip Next's
 * optimiser entirely (the `<Image>`s that render this pass `unoptimized`). 1600px is the
 * widest a full-bleed cover is ever painted at.
 */
const COVER_TRANSFORM = 'f_auto,q_auto,w_1600,c_limit'

/** `null` when there is no cover, or no cloud name configured to build the URL from. */
export const coverUrl = (coverImageId: string | null) =>
  coverImageId && CLOUDINARY_CLOUD
    ? `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/${COVER_TRANSFORM}/${coverImageId}`
    : null

/**
 * Server-side fetch to get the current logged-in user's profile using the session cookie.
 */
export const getMyProfile = cache(async (cookie: string | null): Promise<SelfProfile | null> => {
  const user = await getMeServer(cookie)
  if (!user) return null
  return getProfile(user.id, cookie) as Promise<SelfProfile | null>
})
