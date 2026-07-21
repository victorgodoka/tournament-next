import type { DiscordMe } from '@app/discord/discord.types'

const OAUTH_STATE_KEY = 'discord_oauth_state'

export type OAuthTokens = {
  accessToken: string
  tokenType: string
  expiresIn: string
}

type ParsedCallback =
  | { kind: 'none' }
  | { kind: 'code'; code: string }
  | { kind: 'tokens'; tokens: OAuthTokens }
  | { kind: 'error'; message: string }

type CompleteLoginResult =
  | { ok: true; user: DiscordMe }
  | { ok: false; message: string }

function isBrowser() {
  return typeof window !== 'undefined'
}

export function createOAuthState(): string {
  const state = crypto.randomUUID()
  sessionStorage.setItem(OAUTH_STATE_KEY, state)
  return state
}

function consumeExpectedOAuthState(): string | null {
  const expected = sessionStorage.getItem(OAUTH_STATE_KEY)
  sessionStorage.removeItem(OAUTH_STATE_KEY)
  return expected
}

function validateReturnedState(returned: string | null): boolean {
  const expected = consumeExpectedOAuthState()
  if (!expected) return false
  return returned === expected
}

export function buildDiscordOAuthUrl(authorizeUrl: string): string {
  if (!authorizeUrl) return ''

  const url = new URL(authorizeUrl)
  url.searchParams.set('state', createOAuthState())
  return url.toString()
}

function parseSearchParams(searchParams: string): ParsedCallback {
  const params = new URLSearchParams(searchParams)
  const oauthError = params.get('error')

  if (oauthError) {
    return {
      kind: 'error',
      message: params.get('error_description') || oauthError,
    }
  }

  const code = params.get('code')
  if (code) {
    if (!validateReturnedState(params.get('state'))) {
      return { kind: 'error', message: 'Invalid OAuth state. Please try signing in again.' }
    }

    return { kind: 'code', code }
  }

  const accessToken = params.get('access_token')
  const tokenType = params.get('token_type')
  const expiresIn = params.get('expires_in')

  if (accessToken && tokenType && expiresIn) {
    if (!validateReturnedState(params.get('state'))) {
      return { kind: 'error', message: 'Invalid OAuth state. Please try signing in again.' }
    }

    return {
      kind: 'tokens',
      tokens: { accessToken, tokenType, expiresIn },
    }
  }

  return { kind: 'none' }
}

function readCallbackFromUrl(): ParsedCallback {
  if (!isBrowser()) return { kind: 'none' }

  const currentUrl = window.location.href

  if (window.location.search) {
    const parsed = parseSearchParams(window.location.search.substring(1))
    if (parsed.kind !== 'none') return parsed
  }

  if (window.location.hash.includes('access_token') || window.location.hash.includes('code=')) {
    const hashPart = window.location.hash.substring(1)
    const searchParams = hashPart.includes('?') ? hashPart.split('?')[1] ?? '' : hashPart
    const parsed = parseSearchParams(searchParams)
    if (parsed.kind !== 'none') return parsed
  }

  // Legacy quirk: some Discord redirects arrive with the query string mangled
  // into an URL-encoded hash fragment ("#%2F%3F=&…" = "#/?=&…"). Rewrite it
  // back into a real query string so the params can be parsed normally.
  if (currentUrl.includes('#%2F%3F=&')) {
    const cleanedUrl = currentUrl.replace('#%2F%3F=&', '?&')
    const url = new URL(cleanedUrl)
    if (url.search) {
      const parsed = parseSearchParams(url.search.substring(1))
      if (parsed.kind !== 'none') return parsed
    }
  }

  return { kind: 'none' }
}

export function clearOAuthParamsFromUrl() {
  if (!isBrowser()) return
  window.history.replaceState({}, document.title, window.location.pathname)
}

/** Reads the OAuth redirect (code, implicit-flow tokens, or an error) directly
 * off the URL and clears it from the address bar. Nothing is written to
 * storage here — the caller acts on the returned value immediately. */
export function parseOAuthCallbackFromUrl(): ParsedCallback {
  const parsed = readCallbackFromUrl()

  if (parsed.kind !== 'none') {
    clearOAuthParamsFromUrl()
  }

  return parsed
}

/**
 * Completes the OAuth flow via /api/auth/discord/login: the server exchanges
 * the code (or verifies the already-issued token), mints the app session
 * cookie, and returns the Discord identity — never the access token itself.
 */
export async function completeDiscordLogin(
  input: { code: string } | { accessToken: string; tokenType: string },
): Promise<CompleteLoginResult> {
  try {
    const response = await fetch('/api/auth/discord/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    const data: unknown = await response.json()

    if (
      typeof data === 'object' &&
      data !== null &&
      'success' in data &&
      data.success === true &&
      'user' in data
    ) {
      return { ok: true, user: data.user as DiscordMe }
    }

    const message =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof data.message === 'string'
        ? data.message
        : 'Failed to complete Discord sign-in.'

    return { ok: false, message }
  } catch {
    return { ok: false, message: 'Network error during Discord sign-in.' }
  }
}
