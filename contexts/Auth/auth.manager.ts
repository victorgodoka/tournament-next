import { API_ENDPOINTS } from '../../const/index'
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isLoginPayload(data: unknown): data is {
  success: true
  token: string
  expiresIn?: string
  message?: string
} {
  return (
    isRecord(data) &&
    data.success === true &&
    typeof data.token === 'string'
  )
}

function isVerifyPayload(data: unknown): data is {
  success: boolean
  user?: VerifyResponse['user']
  message?: string
} {
  return isRecord(data) && typeof data.success === 'boolean'
}

export class AuthManager {
  private static readonly TOKEN_KEY = 'omega_auth_token'
  private static readonly USER_ID_KEY = 'omega_user_id'

  static async login(userId: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_ENDPOINTS.MAIN}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      const data: unknown = await response.json()

      if (response.ok && isLoginPayload(data)) {
        this.setToken(data.token)
        this.setUserId(userId)
        return {
          success: true,
          token: data.token,
          expiresIn: data.expiresIn,
        }
      }

      const message =
        isRecord(data) && typeof data.message === 'string'
          ? data.message
          : 'Login failed'

      return {
        success: false,
        message,
      }
    } catch {
      return {
        success: false,
        message: 'Network error during login',
      }
    }
  }

  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token)
  }

  static setUserId(userId: string): void {
    localStorage.setItem(this.USER_ID_KEY, userId)
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY)
  }

  static getUserId(): string | null {
    return localStorage.getItem(this.USER_ID_KEY)
  }

  static isLoggedIn(): boolean {
    return this.getToken() !== null
  }

  static async verifyToken(): Promise<VerifyResponse> {
    const token = this.getToken()

    if (!token) {
      return {
        success: false,
        message: 'No token found',
      }
    }

    try {
      const response = await fetch(`${API_ENDPOINTS.MAIN}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

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

  static logout(): void {
    localStorage.removeItem(this.TOKEN_KEY)
    localStorage.removeItem(this.USER_ID_KEY)

    for (const key of OAUTH_STORAGE_KEYS) {
      localStorage.removeItem(key)
    }
  }

  static getAuthHeader(): { Authorization: string } | Record<string, never> {
    const token = this.getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
}
