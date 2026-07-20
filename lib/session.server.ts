import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'omega_session'

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value ?? null
}

/**
 * Decode-only read of the JWT payload's `id` (the user's Discord id). No
 * signature check — use for UX gating (e.g. hiding the edit page from
 * non-owners) only; the backend re-verifies ownership on every write.
 */
export async function getSessionUserId(): Promise<string | null> {
  const token = await getSessionToken()
  if (!token) return null

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    )
    if (typeof payload === 'object' && payload !== null && 'id' in payload) {
      const { id } = payload as { id: unknown }
      return typeof id === 'string' ? id : null
    }
    return null
  } catch {
    return null
  }
}
