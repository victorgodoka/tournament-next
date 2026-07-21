import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'omega_session'

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value ?? null
}

/**
 * Decode-only read of a JWT payload's `id` (the user's Discord id). No
 * signature check — use for UX gating (e.g. hiding the edit page from
 * non-owners) only; the backend re-verifies ownership on every write.
 *
 * Sync so callers that already hold the token can decode without a second
 * `cookies()` read (avoids a redundant awaited store lookup).
 */
export function decodeSessionUserId(token: string | null): string | null {
  if (!token) return null

  try {
    const payload: unknown = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
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

/** Convenience wrapper for callers that don't already hold the token. */
export async function getSessionUserId(): Promise<string | null> {
  return decodeSessionUserId(await getSessionToken())
}
