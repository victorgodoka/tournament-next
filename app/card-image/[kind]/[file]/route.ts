import { CARD_ART_URL, CARD_IMAGE_URL } from '@utils/const'

/**
 * A same-origin copy of a ygopro.online scan (`common`) or art (`arts`), as the canvases need: the host sends
 * no CORS headers, which would taint them. The optimiser (`/_next/image`) also served them, but it resizes every
 * new `url`+`w`+`q` on this server (a cold deck export queued 40 of those, seconds each under load), its disk
 * cache dies with each deploy, and the CDN never caches that path. A `.jpg` path is cached at the edge by default,
 * so each card costs the origin fetch once; the bytes are the original's (~60 KB a scan, ~110 KB an art).
 */
const SOURCE = { common: CARD_IMAGE_URL, arts: CARD_ART_URL } as const
const FILE = /^(\d{1,10})\.jpg$/

export const GET = async (_: Request, { params }: { params: Promise<{ kind: string; file: string }> }) => {
  const { kind, file } = await params
  const id = FILE.exec(file)?.[1]
  const source = kind in SOURCE ? SOURCE[kind as keyof typeof SOURCE] : null
  if (!id || !source) return new Response(null, { status: 404 })
  const upstream = await fetch(source(id), { signal: AbortSignal.timeout(8_000) }).catch(() => null)
  if (!upstream?.ok) return new Response(null, { status: upstream?.status === 404 ? 404 : 502, headers: { 'Cache-Control': 'public, max-age=300' } })
  return new Response(upstream.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } })
}
