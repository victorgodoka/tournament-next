import { NextResponse } from 'next/server'
import { API_ENDPOINTS } from '@const'
import { isRecord } from '@lib/api-result'
import { SESSION_COOKIE } from '@lib/session.server'
import type { DiscordMe, DiscordUser } from '@app/discord/discord.types'

/**
 * Completes Discord OAuth end to end on the server: exchanges the
 * authorization code (or accepts an already-issued token from the implicit
 * flow), verifies it against Discord, and mints the app session — all in one
 * request. The Discord access token never leaves the server and is never
 * persisted anywhere; only the resulting httpOnly session cookie and a
 * minimal, non-sensitive Discord identity are returned to the client.
 */

type DiscordTokens = { accessToken: string; tokenType: string }

function isDiscordTokenPayload(data: unknown): data is {
  access_token: string
  token_type: string
} {
  return (
    isRecord(data) &&
    typeof data.access_token === 'string' &&
    typeof data.token_type === 'string'
  )
}

function isDiscordUser(data: unknown): data is DiscordUser {
  if (!isRecord(data)) return false

  const avatar = data.avatar
  const globalName = data.global_name

  return (
    typeof data.id === 'string' &&
    typeof data.username === 'string' &&
    typeof data.discriminator === 'string' &&
    (typeof avatar === 'string' || avatar === null) &&
    (typeof globalName === 'string' || globalName === null)
  )
}

function toDiscordMe(data: DiscordUser): DiscordMe {
  return {
    id: data.id,
    username: data.username,
    avatar: data.avatar,
    global_name: data.global_name,
  }
}

async function exchangeCodeForToken(code: string): Promise<{ ok: true; tokens: DiscordTokens } | { ok: false; message: string; status: number }> {
  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  const redirectUri = process.env.DISCORD_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return { ok: false, message: 'Discord OAuth is not configured on the server.', status: 500 }
  }

  try {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    const data: unknown = await response.json()

    if (!response.ok || !isDiscordTokenPayload(data)) {
      const message =
        isRecord(data) && typeof data.error_description === 'string'
          ? data.error_description
          : isRecord(data) && typeof data.error === 'string'
            ? data.error
            : 'Discord token exchange failed.'
      return { ok: false, message, status: response.ok ? 502 : response.status }
    }

    return { ok: true, tokens: { accessToken: data.access_token, tokenType: data.token_type } }
  } catch {
    return { ok: false, message: 'Network error during Discord token exchange.', status: 502 }
  }
}

async function fetchDiscordUser(tokens: DiscordTokens): Promise<{ ok: true; user: DiscordMe } | { ok: false; message: string; status: number }> {
  try {
    const response = await fetch(`${API_ENDPOINTS.DISCORD}/users/@me`, {
      headers: { Authorization: `${tokens.tokenType} ${tokens.accessToken}` },
    })

    if (!response.ok) {
      return { ok: false, message: 'Failed to verify Discord account.', status: 401 }
    }

    const data: unknown = await response.json()
    if (!isDiscordUser(data)) {
      return { ok: false, message: 'Invalid Discord user response.', status: 502 }
    }

    return { ok: true, user: toDiscordMe(data) }
  } catch {
    return { ok: false, message: 'Network error while verifying Discord account.', status: 502 }
  }
}

async function mintAppSession(tokens: DiscordTokens): Promise<{ ok: true; token: string; expiresIn: number } | { ok: false; message: string; status: number }> {
  try {
    const response = await fetch(`${API_ENDPOINTS.MAIN}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordAccessToken: tokens.accessToken, discordTokenType: tokens.tokenType }),
    })

    const data: unknown = await response.json()
    const token = isRecord(data) && typeof data.token === 'string' ? data.token : null
    const expiresIn = isRecord(data) && typeof data.expiresIn === 'string' ? Number(data.expiresIn) : NaN

    if (!response.ok || !token) {
      const message = isRecord(data) && typeof data.message === 'string' ? data.message : 'Login failed.'
      return { ok: false, message, status: response.ok ? 401 : response.status }
    }

    return { ok: true, token, expiresIn }
  } catch {
    return { ok: false, message: 'Network error during login.', status: 502 }
  }
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 })
  }

  const code = isRecord(body) && typeof body.code === 'string' ? body.code.trim() : ''
  const directAccessToken =
    isRecord(body) && typeof body.accessToken === 'string' ? body.accessToken : ''
  const directTokenType =
    isRecord(body) && typeof body.tokenType === 'string' ? body.tokenType : ''

  let tokens: DiscordTokens
  if (code) {
    const exchange = await exchangeCodeForToken(code)
    if (!exchange.ok) {
      return NextResponse.json({ success: false, message: exchange.message }, { status: exchange.status })
    }
    tokens = exchange.tokens
  } else if (directAccessToken && directTokenType) {
    tokens = { accessToken: directAccessToken, tokenType: directTokenType }
  } else {
    return NextResponse.json(
      { success: false, message: 'Authorization code or access token is required.' },
      { status: 400 },
    )
  }

  const discordUser = await fetchDiscordUser(tokens)
  if (!discordUser.ok) {
    return NextResponse.json({ success: false, message: discordUser.message }, { status: discordUser.status })
  }

  const session = await mintAppSession(tokens)
  if (!session.ok) {
    return NextResponse.json({ success: false, message: session.message }, { status: session.status })
  }

  const res = NextResponse.json({ success: true, user: discordUser.user })
  res.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Number.isFinite(session.expiresIn) ? session.expiresIn : undefined,
  })
  return res
}
