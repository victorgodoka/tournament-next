import { getSessionToken } from '@lib/session.server'
import { proxyJson } from '@lib/api-proxy'

/** Proxies the saved-decks-by-user lookup so the httpOnly session cookie
 * (invisible to client JS) can still be forwarded as a Bearer token.
 * Optional auth: without `?auth=1` it forwards no token and the upstream
 * returns only that user's public decks. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params
  const includeAuth = new URL(request.url).searchParams.get('auth') === '1'
  const token = includeAuth ? await getSessionToken() : null

  return proxyJson(`/decks/user/${encodeURIComponent(userId)}`, { method: 'GET', token })
}
