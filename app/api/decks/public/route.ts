import { getSessionToken } from '@lib/session.server'
import { proxyJson } from '@lib/api-proxy'

/** Proxies the public decks feed so the httpOnly session cookie can be
 * forwarded as a Bearer token — that's what lets the response carry `liked`
 * per deck for the current user. Auth is optional: anonymous callers just get
 * `liked: false`. The incoming query string (filters/sort/page) is passed through. */
export async function GET(request: Request) {
  const token = await getSessionToken()
  const { search } = new URL(request.url)

  return proxyJson(`/saved-decks/public/all${search}`, { method: 'GET', token })
}
