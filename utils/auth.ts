/**
 * Discord sign-in against omega-server-v3 (see its AUTH.md).
 * The `omega_session` cookie is HttpOnly. Browser calls use `credentials: 'include'`; SSR
 * (`getMeServer`) only sees it when the API sets `COOKIE_DOMAIN` to the shared parent domain.
 */

import type { Cosmetics } from './types'
import { LOGIN_PENDING_KEY, track } from './gtm'

export const API_URL =process.env.NEXT_PUBLIC_API_URL ?? ''

export const SESSION_COOKIE = 'omega_session'

export type Permission =
  | 'wiki.write'
  | 'wiki.delete'
  | 'analytics.write'
  | 'user.manage'
  | 'system.manage'

export type AuthUser = {
  /** Discord snowflake. Keep it a string, it exceeds 2^53. */
  id: string
  status: 'ACTIVE'
  role: 'USER' | 'EDITOR' | 'ANALYST' | 'ADMIN'
  /** Show/hide UI with this, never with `role`. The API still checks every call. */
  permissions: Permission[]
  profile: { username: string | null; avatarUrl: string | null }
  createdAt: string
  /** Game accountrank >= 1, staff included. Hides every ad and the VIP promo. */
  isVip: boolean
  /** `welcome` + `avatar` slots (BACKGROUND, WEBDECO). The welcome page's background comes from here. */
  cosmetics: Cosmetics
}

/** Copy for `/login?error=<code>`. Unknown codes fall back to `auth_failed`. */
export const LOGIN_ERRORS = {
  auth_failed: "Sign-in didn't complete. Please try again.",
  not_registered: "This Discord account isn't registered on Omega yet.",
  account_not_active: "This account can't sign in right now.",
} as const

export const loginErrorMessage = (code: string) =>
  LOGIN_ERRORS[code as keyof typeof LOGIN_ERRORS] ?? LOGIN_ERRORS.auth_failed

/** The OAuth dance is a redirect chain, so it must be a full-page navigation, not a fetch. */
export const signIn = () => {
  track('login_start', { method: 'discord' })
  // The tab comes back signed in: `Tracking` reads this to report the `login` / `sign_up`.
  try {
    sessionStorage.setItem(LOGIN_PENDING_KEY, '1')
  } catch {}
  window.location.assign(`${API_URL}/auth/discord`)
}

/** `null` means signed out (401). Anything else unexpected throws. */
export const fetchMe = async (signal?: AbortSignal): Promise<AuthUser | null> => {
  const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include', signal })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`GET /auth/me failed with ${res.status}`)
  return res.json()
}

/** Always 204, whether or not the session was still valid. The browser adds the `Origin` header. */
export const logout = async () => {
  const res = await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
  if (!res.ok) throw new Error(`POST /auth/logout failed with ${res.status}`)
}

/** Server-side fetch to get the current logged-in user's AuthUser object using the session cookie. */
export const getMeServer = async (cookie: string | null, signal?: AbortSignal): Promise<AuthUser | null> => {
  const once = () => fetch(`${API_URL}/auth/me`, { headers: cookie ? { cookie } : undefined, cache: 'no-store', signal })
  // One retry: a dropped keep-alive socket or a 5xx blip must not read as "signed out",
  // which the gated wiki pages would turn into a 404.
  let res = await once().catch(() => null)
  if (!res || res.status >= 500) res = await once()
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`GET /auth/me failed with ${res.status}`)
  return res.json()
}
