const DISCORD_TOKEN_KEY = 'discord_token'

export type OAuthParams = {
  accessToken: string | null
  tokenType: string | null
  expiresIn: string | null
}

export function getOAuthParams(): OAuthParams {
  return {
    accessToken: localStorage.getItem('access_token'),
    tokenType: localStorage.getItem('token_type'),
    expiresIn: localStorage.getItem('expires_in'),
  }
}

export function cleanupOAuthParams() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('token_type')
  localStorage.removeItem('expires_in')
  localStorage.removeItem('scope')
  localStorage.removeItem('state')
}

export function isDiscordTokenValid() {
  const rawToken = localStorage.getItem(DISCORD_TOKEN_KEY)
  if (!rawToken) return false

  try {
    const tokenData = JSON.parse(rawToken) as {
      expiresAt?: number
    }

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
}: {
  accessToken: string
  tokenType: string
  expiresIn: string
}) {
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

export function clearOAuthHashFromUrl() {
  const [path] = window.location.hash.split('?')
  const nextHash = path || '#/'
  window.history.replaceState({}, document.title, `${window.location.pathname}${nextHash}`)
}
