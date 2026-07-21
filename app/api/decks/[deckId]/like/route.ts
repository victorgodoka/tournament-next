import { NextResponse } from 'next/server'
import { getSessionToken } from '@lib/session.server'
import { proxyJson } from '@lib/api-proxy'

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

  return proxyJson(`/saved-decks/${encodeURIComponent(deckId)}/like`, { method: 'POST', token })
}
