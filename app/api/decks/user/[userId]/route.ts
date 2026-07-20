import { NextResponse } from 'next/server'
import { API_ENDPOINTS } from '@const'
import { authHeader } from '@lib/auth-header'
import { getSessionToken } from '@lib/session.server'

/** Proxies the saved-decks-by-user lookup so the httpOnly session cookie
 * (invisible to client JS) can still be forwarded as a Bearer token. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params
  const includeAuth = new URL(request.url).searchParams.get('auth') === '1'
  const token = includeAuth ? await getSessionToken() : null

  const response = await fetch(
    `${API_ENDPOINTS.MAIN}/decks/user/${encodeURIComponent(userId)}`,
    { headers: authHeader(token) },
  )

  const data: unknown = await response.json()
  return NextResponse.json(data, { status: response.status })
}
