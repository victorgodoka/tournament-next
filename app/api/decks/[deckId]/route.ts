import { NextResponse } from 'next/server'
import { getSessionToken } from '@lib/session.server'
import { proxyJson } from '@lib/api-proxy'

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

  return proxyJson(`/saved-decks/${encodeURIComponent(deckId)}`, { method: 'PUT', token, body })
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { deckId } = await params
  const token = await getSessionToken()

  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  return proxyJson(`/saved-decks/${encodeURIComponent(deckId)}`, { method: 'DELETE', token })
}
