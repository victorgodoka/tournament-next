/**
 * Discord sign-in against omega-server-v3 (see its AUTH.md).
 * The `omega_session` cookie is HttpOnly and scoped to the API host, so every call runs in the
 * browser with `credentials: 'include'`. The Next server never sees the cookie.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export type Permission =
  | 'tournament.read'
  | 'tournament.create'
  | 'tournament.update'
  | 'tournament.delete'
  | 'user.manage'
  | 'system.manage'

export type AuthUser = {
  /** Discord snowflake. Keep it a string, it exceeds 2^53. */
  id: string
  status: 'ACTIVE'
  role: 'USER' | 'MODERATOR' | 'ADMIN'
  /** Show/hide UI with this, never with `role`. The API still checks every call. */
  permissions: Permission[]
  profile: { username: string | null; avatarUrl: string | null }
  createdAt: string
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
export const signIn = () => window.location.assign(`${API_URL}/auth/discord`)

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
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: cookie ? { cookie } : undefined,
    cache: 'no-store',
    signal,
  })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`GET /auth/me failed with ${res.status}`)
  return res.json()
}
