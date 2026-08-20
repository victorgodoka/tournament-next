import { proxyJson } from '@lib/api-proxy'

/** Proxies card search server-side — the upstream cards API only reflects
 * CORS for a small origin whitelist that production isn't on, so a direct
 * browser fetch fails there while working in local dev. */
export async function GET(request: Request) {
  const { search } = new URL(request.url)
  return proxyJson(`/cards${search}`, { method: 'GET', token: null })
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null)
  return proxyJson('/cards', { method: 'POST', token: null, body: body ?? {} })
}
