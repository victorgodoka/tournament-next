const AUTH_REDIRECT_FROM_KEY = 'auth:redirect-from'

export function setAuthRedirectFrom(path: string): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(AUTH_REDIRECT_FROM_KEY, path)
}

export function getAuthRedirectFrom(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(AUTH_REDIRECT_FROM_KEY)
}

export function consumeAuthRedirectFrom(fallback = '/'): string {
  const from = getAuthRedirectFrom()
  if (from) {
    sessionStorage.removeItem(AUTH_REDIRECT_FROM_KEY)
    return from
  }
  return fallback
}
