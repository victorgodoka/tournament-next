import { API_ENDPOINTS } from '@const'

/** Proxies the official Konami decklist PDF server-side — same CORS gap as
 * /api/cards and /api/convert, and this one returns a binary body so it
 * can't go through the JSON-only proxyJson helper. */
export async function GET(request: Request) {
  const { search } = new URL(request.url)
  const response = await fetch(`${API_ENDPOINTS.MAIN}/pdf/generate${search}`)

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null)
    const error =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Failed to generate PDF.'
    return Response.json({ error }, { status: response.status })
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/pdf',
      'Content-Disposition': response.headers.get('content-disposition') ?? 'inline; filename="decklist.pdf"',
    },
  })
}
