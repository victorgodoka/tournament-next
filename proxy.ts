import { NextResponse, type NextRequest } from 'next/server'

/**
 * Bot guard for `/profile/*`. Every profile view is an SSR call to the API's
 * heaviest read (~8 Postgres queries), and each profile links its opponents, so a
 * crawler walks them forever. On 2026-10-26 one did and drained the API's pool.
 * The API only sees this container's IP, so this is the last place that knows the
 * visitor.
 *
 * Trusts `cf-connecting-ip`: only valid while the container is reachable through
 * Cloudflare alone.
 */

/** Scrapers that never bring a visitor back. Search engines stay allowed. */
const BLOCKED_AGENTS = /GPTBot|ClaudeBot|anthropic-ai|Bytespider|CCBot|Amazonbot|meta-externalagent|PetalBot|ImagesiftBot|Diffbot|omgili/i

const LIMIT = 20
const WINDOW_MS = 60_000
/** Past this many IPs, expired windows are dropped before counting. */
const SWEEP_AT = 10_000

// ponytail: in-memory fixed window, one container. Several replicas need a shared store.
const hits = new Map<string, { start: number; count: number }>()

/** `true` while `ip` is within LIMIT requests in the current window. */
export const allow = (ip: string, now = Date.now()): boolean => {
  if (hits.size > SWEEP_AT) {
    for (const [key, entry] of hits) if (now - entry.start >= WINDOW_MS) hits.delete(key)
  }
  const entry = hits.get(ip)
  if (!entry || now - entry.start >= WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 })
    return true
  }
  entry.count += 1
  return entry.count <= LIMIT
}

export function proxy(request: NextRequest) {
  const agent = request.headers.get('user-agent') ?? ''
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

  if (BLOCKED_AGENTS.test(agent)) {
    console.warn(JSON.stringify({ event: 'BOT_BLOCKED', reason: 'agent', ip, agent, path: request.nextUrl.pathname }))
    return new NextResponse(null, { status: 403 })
  }
  if (ip && !allow(ip)) {
    console.warn(JSON.stringify({ event: 'BOT_BLOCKED', reason: 'rate', ip, agent, path: request.nextUrl.pathname }))
    return new NextResponse(null, { status: 429, headers: { 'retry-after': String(WINDOW_MS / 1000) } })
  }
  return NextResponse.next()
}

export const config = {
  // Prefetches of the opponents' links don't reach the API (they stop at the
  // loading boundary) and would eat a visitor's budget: skip them.
  matcher: [
    {
      source: '/profile/:path*',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
