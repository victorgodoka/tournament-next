import { NextResponse } from 'next/server'
import { isRecord } from '@lib/api-result'

function isTokenPayload(data: unknown): data is {
  access_token: string
  token_type: string
  expires_in: number
} {
  return (
    isRecord(data) &&
    typeof data.access_token === 'string' &&
    typeof data.token_type === 'string' &&
    typeof data.expires_in === 'number'
  )
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  const code =
    isRecord(body) && typeof body.code === 'string' ? body.code.trim() : ''

  if (!code) {
    return NextResponse.json({ message: 'Authorization code is required.' }, { status: 400 })
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  const redirectUri = process.env.DISCORD_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { message: 'Discord OAuth is not configured on the server.' },
      { status: 500 },
    )
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

    if (!response.ok) {
      const message =
        isRecord(data) && typeof data.error_description === 'string'
          ? data.error_description
          : isRecord(data) && typeof data.error === 'string'
            ? data.error
            : 'Discord token exchange failed.'

      return NextResponse.json({ message }, { status: response.status })
    }

    if (!isTokenPayload(data)) {
      return NextResponse.json(
        { message: 'Invalid token response from Discord.' },
        { status: 502 },
      )
    }

    return NextResponse.json({
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: String(data.expires_in),
    })
  } catch {
    return NextResponse.json(
      { message: 'Network error during Discord token exchange.' },
      { status: 502 },
    )
  }
}
