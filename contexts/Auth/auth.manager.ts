import { isRecord } from '@lib/api-result'
import { dispatchAuthExpired } from './auth.events'
import type { VerifyResponse } from './auth.types'

// Only 'discord_token' was ever actually written under this scheme (pre
// server-side login); the others are cleaned up defensively in case a
// browser still has them from before that change shipped.
const OAUTH_STORAGE_KEYS = [
  'access_token',
  'token_type',
  'expires_in',
  'scope',
  'state',
  'discord_token',
] as const

function isVerifyPayload(data: unknown): data is {
  success: boolean
  user?: VerifyResponse['user']
  message?: string
} {
  return isRecord(data) && typeof data.success === 'boolean'
}

/**
 * The app session lives in an httpOnly cookie minted by
 * /api/auth/discord/login — invisible to (and unreadable by) client JS.
 * These functions only orchestrate calls to session-lifecycle routes; they
 * never hold the JWT (or any Discord token) themselves.
 */
export async function verifyToken(): Promise<VerifyResponse> {
  try {
    const response = await fetch('/api/auth/session')
    const data: unknown = await response.json()

    if (!isVerifyPayload(data)) {
      dispatchAuthExpired('Invalid verification response')
      return {
        success: false,
        message: 'Invalid verification response',
      }
    }

    if (!data.success) {
      dispatchAuthExpired(data.message ?? 'Session expired')
    }

    return {
      success: data.success,
      user: data.user,
      message: data.message,
    }
  } catch {
    return {
      success: false,
      message: 'Network error during token verification',
    }
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/session', { method: 'DELETE' })
  } catch {
    // best-effort: the cookie also has its own expiry, and local user
    // state is cleared by the caller regardless of this call's outcome
  }

  for (const key of OAUTH_STORAGE_KEYS) {
    localStorage.removeItem(key)
  }
}
