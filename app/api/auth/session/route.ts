import { NextResponse } from 'next/server'
import { API_ENDPOINTS } from '@const'
import { isRecord } from '@lib/api-result'
import { getSessionToken, SESSION_COOKIE } from '@lib/session.server'

/**
 * Session minting lives in /api/auth/discord/login (the only place a Discord
 * token is ever verified) — this route just checks or clears the resulting
 * httpOnly cookie.
 */
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
