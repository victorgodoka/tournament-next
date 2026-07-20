import { NextResponse } from 'next/server'
import { API_ENDPOINTS } from '@const'
import { authHeader } from '@lib/auth-header'
import { getSessionToken } from '@lib/session.server'

/** Proxies the like toggle so the httpOnly session cookie can be forwarded
 * as a Bearer token — the browser can no longer read it directly. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ deckId: string }> },
) {
  const { deckId } = await params
  const token = await getSessionToken()

  if (!token) {
    return NextResponse.json(
      { success: false, message: 'Authentication required.' },
      { status: 401 },
    )
  }

  const response = await fetch(
    `${API_ENDPOINTS.MAIN}/saved-decks/${encodeURIComponent(deckId)}/like`,
    { method: 'POST', headers: authHeader(token) },
  )

  const data: unknown = await response.json()
  return NextResponse.json(data, { status: response.status })
}
