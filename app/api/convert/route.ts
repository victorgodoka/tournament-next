import { proxyJson } from '@lib/api-proxy'

/** Proxies deck conversion server-side — same CORS gap as /api/cards: the
 * upstream API doesn't allow the production origin, so a direct browser
 * fetch fails there while working in local dev. */
export async function GET(request: Request) {
  const { search } = new URL(request.url)
  return proxyJson(`/convert${search}`, { method: 'GET', token: null })
}

export async function POST(request: Request) {
  const { search } = new URL(request.url)
  const body: unknown = await request.json().catch(() => null)
  return proxyJson(`/convert${search}`, { method: 'POST', token: null, body: body ?? {} })
}
