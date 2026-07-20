import { NextResponse } from 'next/server'
import { API_ENDPOINTS } from '@const'
import { authHeader } from '@lib/auth-header'
import { getSessionToken } from '@lib/session.server'

/** Proxies deck update/delete so the httpOnly session cookie can be
 * forwarded as a Bearer token — the browser cannot read it directly.
 * Ownership is enforced by the upstream API (403 for non-owners). */

type RouteContext = { params: Promise<{ deckId: string }> }

export async function PUT(request: Request, { params }: RouteContext) {
  const { deckId } = await params
  const token = await getSessionToken()

  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const body: unknown = await request.json().catch(() => null)

  if (body === null) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const response = await fetch(
    `${API_ENDPOINTS.MAIN}/saved-decks/${encodeURIComponent(deckId)}`,
    {
      method: 'PUT',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )

  const data: unknown = await response.json()
  return NextResponse.json(data, { status: response.status })
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { deckId } = await params
  const token = await getSessionToken()

  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const response = await fetch(
    `${API_ENDPOINTS.MAIN}/saved-decks/${encodeURIComponent(deckId)}`,
    { method: 'DELETE', headers: authHeader(token) },
  )

  const data: unknown = await response.json()
  return NextResponse.json(data, { status: response.status })
}
