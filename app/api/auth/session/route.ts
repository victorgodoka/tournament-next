import { NextResponse } from 'next/server'
import { API_ENDPOINTS } from '@const'
import { getSessionToken, SESSION_COOKIE } from '@lib/session.server'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Mints the app session from a Discord access token, never a client-supplied
 * user id — the backend is expected to verify the token against Discord
 * itself before issuing a JWT. See code review notes for the /auth/login
 * contract change this depends on.
 */
export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid request body.' }, { status: 400 })
  }

  const discordAccessToken =
    isRecord(body) && typeof body.discordAccessToken === 'string' ? body.discordAccessToken : ''
  const discordTokenType =
    isRecord(body) && typeof body.discordTokenType === 'string' ? body.discordTokenType : 'Bearer'

  if (!discordAccessToken) {
    return NextResponse.json(
      { success: false, message: 'Discord access token is required.' },
      { status: 400 },
    )
  }

  try {
    const response = await fetch(`${API_ENDPOINTS.MAIN}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordAccessToken, discordTokenType }),
    })

    const data: unknown = await response.json()
    const token = isRecord(data) && typeof data.token === 'string' ? data.token : null
    const expiresIn = isRecord(data) && typeof data.expiresIn === 'string' ? Number(data.expiresIn) : NaN

    if (!response.ok || !token) {
      const message = isRecord(data) && typeof data.message === 'string' ? data.message : 'Login failed.'
      return NextResponse.json({ success: false, message }, { status: response.ok ? 401 : response.status })
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Number.isFinite(expiresIn) ? expiresIn : undefined,
    })
    return res
  } catch {
    return NextResponse.json(
      { success: false, message: 'Network error during login.' },
      { status: 502 },
    )
  }
}

export async function GET() {
  const token = await getSessionToken()

  if (!token) {
    return NextResponse.json({ success: false, message: 'No active session.' }, { status: 401 })
  }

  try {
    const response = await fetch(`${API_ENDPOINTS.MAIN}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })

    const data: unknown = await response.json()
    const success = isRecord(data) && data.success === true
    const user = isRecord(data) && isRecord(data.user) ? data.user : undefined

    if (!success) {
      const message =
        isRecord(data) && typeof data.message === 'string' ? data.message : 'Session expired.'
      const res = NextResponse.json({ success: false, message }, { status: 401 })
      res.cookies.delete(SESSION_COOKIE)
      return res
    }

    return NextResponse.json({ success: true, user })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Network error during session verification.' },
      { status: 502 },
    )
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.delete(SESSION_COOKIE)
  return res
}
