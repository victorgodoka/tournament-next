import { NextResponse } from 'next/server'
import { API_ENDPOINTS } from '@const'
import { authHeader } from '@lib/auth-header'
import { getSessionToken } from '@lib/session.server'

/** Proxies the public decks feed so the httpOnly session cookie can be
 * forwarded as a Bearer token — that's what lets the response carry `liked`
 * per deck for the current user. Auth is optional: anonymous callers just get
 * `liked: false`. The incoming query string (filters/sort/page) is passed through. */
export async function GET(request: Request) {
  const token = await getSessionToken()
  const { search } = new URL(request.url)

  const response = await fetch(
    `${API_ENDPOINTS.MAIN}/saved-decks/public/all${search}`,
    { headers: authHeader(token) },
  )

  const data: unknown = await response.json()
  return NextResponse.json(data, { status: response.status })
}
