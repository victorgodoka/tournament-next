import { NextResponse } from 'next/server'
import { getSessionToken } from '@lib/session.server'
import { proxyJson } from '@lib/api-proxy'

/** Proxies deck creation so the httpOnly session cookie can be forwarded
 * as a Bearer token — the browser cannot read it directly. */
export async function POST(request: Request) {
  const token = await getSessionToken()

  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const body: unknown = await request.json().catch(() => null)

  if (body === null) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  return proxyJson('/saved-decks', { method: 'POST', token, body })
}
