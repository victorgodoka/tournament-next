import { isRecord } from '@lib/api-result'
import { dispatchAuthExpired } from './auth.events'
import type { LoginResponse, VerifyResponse } from './auth.types'

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
 * The app session lives in an httpOnly cookie set by /api/auth/session —
 * invisible to (and unreadable by) client JS. These functions only orchestrate
 * calls to that route; they never hold the JWT itself.
 */
export async function login(discordAccessToken: string, discordTokenType: string): Promise<LoginResponse> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordAccessToken, discordTokenType }),
    })

    const data: unknown = await response.json()
    const success = isRecord(data) && data.success === true

    if (response.ok && success) {
      return { success: true }
    }

    const message =
      isRecord(data) && typeof data.message === 'string' ? data.message : 'Login failed'

    return { success: false, message }
  } catch {
    return {
      success: false,
      message: 'Network error during login',
    }
  }
}

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
