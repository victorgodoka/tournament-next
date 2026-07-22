import { NextResponse } from 'next/server'
import { API_ENDPOINTS } from '@const'
import { authHeader } from '@lib/auth-header'
import { getSessionToken } from '@lib/session.server'

/**
 * Proxies the profile-customization update so the httpOnly session cookie can
 * be forwarded as a Bearer token — the browser cannot read it directly. The
 * body is multipart/form-data (the cover image is a File), so unlike the deck
 * proxies it forwards the FormData as-is rather than JSON. The backend still
 * re-verifies ownership from the token.
 */
export async function POST(request: Request) {
  const token = await getSessionToken()

  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const response = await fetch(`${API_ENDPOINTS.MAIN}/duelist`, {
      method: 'POST',
      headers: authHeader(token), // no Content-Type: fetch sets the multipart boundary
      body: form,
    })

    const data: unknown = await response.json().catch(() => null)
    return NextResponse.json(data ?? { error: 'Unexpected upstream response.' }, {
      status: response.status,
    })
  } catch {
    return NextResponse.json({ error: 'Upstream request failed.' }, { status: 502 })
  }
}
