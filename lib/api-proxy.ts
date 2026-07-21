import { NextResponse } from 'next/server'
import { API_ENDPOINTS } from '@const'
import { authHeader } from '@lib/auth-header'

type ProxyInit = {
  method: string
  /** Session JWT to forward as a Bearer token, or null for anonymous calls. */
  token: string | null
  /** JSON body to send; omit for bodyless methods (GET/DELETE). */
  body?: unknown
}

/**
 * Forwards a request to the upstream API and mirrors its JSON response back.
 * Centralises the two failure modes every deck proxy shares: a non-JSON
 * upstream body (gateway HTML, empty body) and a transport-level failure —
 * both otherwise surface to the client as an unhandled 500 / "Unexpected end
 * of JSON input". Auth is left to the caller so optional-auth routes (public
 * reads) can pass a null token without being rejected here.
 */
export async function proxyJson(
  path: string,
  { method, token, body }: ProxyInit,
): Promise<NextResponse> {
  try {
    const response = await fetch(`${API_ENDPOINTS.MAIN}${path}`, {
      method,
      headers: {
        ...authHeader(token),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    const data: unknown = await response.json().catch(() => null)
    return NextResponse.json(data ?? { error: 'Unexpected upstream response.' }, {
      status: response.status,
    })
  } catch {
    return NextResponse.json({ error: 'Upstream request failed.' }, { status: 502 })
  }
}
