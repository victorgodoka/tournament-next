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

/**
 * `null` for an unknown or malformed id, anything else unexpected throws.
 * On the server, pass the incoming `cookie` header so the API sees the viewer's session.
 */
export const getProfile = cache(async (id: string, cookie?: string | null): Promise<Profile | null> => {
  try {
    return await request<Profile>(`/profiles/${encodeURIComponent(id)}`, cookie ? { headers: { cookie } } : undefined)
  } catch (error) {
    if (error instanceof ProfileApiError && error.status === 404) return null
    throw error
  }
})

/** Older duels. A `403` means the profile turned private for this viewer: re-fetch the profile. */
export const getMatches = (id: string, cursor: string, signal?: AbortSignal) =>
  request<MatchPage>(`/profiles/${encodeURIComponent(id)}/matches?cursor=${encodeURIComponent(cursor)}`, { signal })

/** Send changed fields only. Render from the result: the server normalizes what it saves. */
export const updateProfile = (patch: ProfileSettingsPatch) =>
  request<ProfileSettings>('/profiles/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })

/** `fields` is opaque and fully signed: append every entry unchanged. */
type CoverSignature = {
  uploadUrl: string
  fields: Record<string, string | number>
}

/** Cloudinary's content moderation blocked the image. Tell the duelist; don't retry. */
export class CoverRejectedError extends Error {}

/**
 * Signs, uploads straight to Cloudinary, then saves the new id. Check type and size before calling.
 * `coverUrl` is Cloudinary's delivery URL, shown right away.
 * A `ProfileApiError` with code `NOT_CONFIGURED` means uploads are off, so hide the control.
 */
export const uploadCover = async (file: File) => {
  const { uploadUrl, fields } = await request<CoverSignature>('/profiles/me/cover-upload', { method: 'POST' })

  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value))
  form.append('file', file)

  const res = await fetch(uploadUrl, { method: 'POST', body: form })
  const uploaded: {
    public_id?: string
    secure_url?: string
    moderation?: { status: string }[]
    error?: { message: string }
  } = await res.json().catch(() => ({}))
  if (!res.ok || uploaded.error || !uploaded.public_id) {
    throw new Error(`Cover upload failed with ${res.status}: ${uploaded.error?.message ?? 'no public_id'}`)
  }
  if (uploaded.moderation?.some((entry) => entry.status === 'rejected')) throw new CoverRejectedError()

  const settings = await updateProfile({ coverImageId: uploaded.public_id })
  return { settings, coverUrl: uploaded.secure_url ?? null }
}

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

/** `null` when there is no cover, or no cloud name configured to build the URL from. */
export const coverUrl = (coverImageId: string | null) =>
  coverImageId && CLOUDINARY_CLOUD ? `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/${coverImageId}` : null

/**
 * Server-side fetch to get the current logged-in user's profile using the session cookie.
 */
export const getMyProfile = cache(async (cookie: string | null): Promise<SelfProfile | null> => {
  const user = await getMeServer(cookie)
  if (!user) return null
  return getProfile(user.id, cookie) as Promise<SelfProfile | null>
})
