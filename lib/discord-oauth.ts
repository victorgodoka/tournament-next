const DISCORD_TOKEN_KEY = 'discord_token'
const OAUTH_STATE_KEY = 'discord_oauth_state'

const OAUTH_PARAM_KEYS = [
  'access_token',
  'token_type',
  'expires_in',
  'scope',
  'state',
] as const

export type OAuthParams = {
  accessToken: string | null
  tokenType: string | null
  expiresIn: string | null
}

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

type TokenExchangeResponse =
  | { ok: true; tokens: OAuthTokens }
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

function storeTransientOAuthParams(tokens: OAuthTokens, scope = '', state = '') {
  localStorage.setItem('access_token', tokens.accessToken)
  localStorage.setItem('token_type', tokens.tokenType)
  localStorage.setItem('expires_in', tokens.expiresIn)
  localStorage.setItem('scope', scope)
  localStorage.setItem('state', state)
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
    const searchParams = hashPart.includes('?') ? hashPart.split('?')[1] : hashPart
    const parsed = parseSearchParams(searchParams)
    if (parsed.kind !== 'none') return parsed
  }

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

export function parseOAuthCallbackFromUrl(): ParsedCallback {
  const parsed = readCallbackFromUrl()

  if (parsed.kind === 'tokens') {
    storeTransientOAuthParams(parsed.tokens)
    clearOAuthParamsFromUrl()
    return { kind: 'none' }
  }

  if (parsed.kind === 'code' || parsed.kind === 'error') {
    clearOAuthParamsFromUrl()
  }

  return parsed
}

export async function exchangeAuthorizationCode(code: string): Promise<TokenExchangeResponse> {
  try {
    const response = await fetch('/api/auth/discord/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })

    const data: unknown = await response.json()

    if (!response.ok) {
      const message =
        typeof data === 'object' &&
        data !== null &&
        'message' in data &&
        typeof data.message === 'string'
          ? data.message
          : 'Failed to exchange Discord authorization code.'

      return { ok: false, message }
    }

    if (
      typeof data === 'object' &&
      data !== null &&
      'accessToken' in data &&
      'tokenType' in data &&
      'expiresIn' in data &&
      typeof data.accessToken === 'string' &&
      typeof data.tokenType === 'string' &&
      typeof data.expiresIn === 'string'
    ) {
      const tokens = {
        accessToken: data.accessToken,
        tokenType: data.tokenType,
        expiresIn: data.expiresIn,
      }
      storeTransientOAuthParams(tokens)
      return { ok: true, tokens }
    }

    return { ok: false, message: 'Invalid token response from server.' }
  } catch {
    return { ok: false, message: 'Network error during Discord authorization.' }
  }
}

export function getOAuthParams(): OAuthParams {
  return {
    accessToken: localStorage.getItem('access_token'),
    tokenType: localStorage.getItem('token_type'),
    expiresIn: localStorage.getItem('expires_in'),
  }
}

export function hasOAuthParams() {
  const { accessToken, tokenType, expiresIn } = getOAuthParams()
  return Boolean(accessToken && tokenType && expiresIn)
}

export function cleanupOAuthParams() {
  for (const key of OAUTH_PARAM_KEYS) {
    localStorage.removeItem(key)
  }
}

export function isDiscordTokenValid() {
  const rawToken = localStorage.getItem(DISCORD_TOKEN_KEY)
  if (!rawToken) return false

  try {
    const tokenData = JSON.parse(rawToken) as { expiresAt?: number }
    return Boolean(tokenData.expiresAt && tokenData.expiresAt > Date.now())
  } catch {
    localStorage.removeItem(DISCORD_TOKEN_KEY)
    return false
  }
}

export function persistDiscordToken({
  accessToken,
  tokenType,
  expiresIn,
}: OAuthTokens) {
  const expiresAt = Date.now() + Number.parseInt(expiresIn, 10) * 1000

  if (!Number.isFinite(expiresAt)) {
    throw new Error('Invalid Discord token expiration.')
  }

  localStorage.setItem(
    DISCORD_TOKEN_KEY,
    JSON.stringify({
      accessToken,
      tokenType,
      expiresAt,
    }),
  )
}
