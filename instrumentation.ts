import type { Instrumentation } from 'next'
import { log } from '@utils/log'

/**
 * Server-side calls to the API give up after `API_TIMEOUT`. Node's fetch otherwise waits up to
 * 300 s on a stalled API, and every render parked on it stays in the heap: one bad spell of the
 * API held enough of them to run the container out of memory.
 */
const API_TIMEOUT = 8_000

/**
 * Every uncaught error of a render, route handler or server action, with where it happened: Next
 * alone prints the stack and nothing else. An `error.tsx` boundary catches the render, not this
 * line. `digest` is what the error page shows, so a reader's report finds the line.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  log('error', 'REQUEST_ERROR', { method: request.method, path: request.path, ...context, digest: (error as { digest?: string }).digest, err: error })
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  /**
   * The infographic PNGs go through sharp (`next/og` rasterises Satori's SVG with it when sharp
   * resolves). libvips keeps each rendered SVG in its operation cache, ~40 MB apiece, outside V8's
   * heap and well past the 50 MB the cache claims: 15 renders held 700 MB and the container was
   * killed. Off, nothing outlives the render (measured 2026-10-29: 180 MB flat after 15).
   */
  ;(await import('sharp')).default.cache(false)
  const api = process.env.NEXT_PUBLIC_API_URL
  if (!api) return
  /**
   * Runtime-only, e.g. `http://omega-api:3000`: with the API on the same Docker host, the server
   * reaches it over the shared network instead of going out through Cloudflare. The browser keeps
   * `NEXT_PUBLIC_API_URL`, and Next's cache keys keep the public URL too.
   */
  const internal = process.env.API_INTERNAL_URL
  // Installed before Next patches fetch on the first render, so this wraps the real network call,
  // background revalidations included (Next drops the caller's signal on those).
  const fetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(api)) return fetch(input, init)
    const own = init?.signal ?? (input instanceof Request ? input.signal : undefined)
    const timeout = AbortSignal.timeout(API_TIMEOUT)
    if (internal) {
      const target = internal + url.slice(api.length)
      input = input instanceof Request ? new Request(target, input) : target
    }
    return fetch(input, { ...init, signal: own ? AbortSignal.any([own, timeout]) : timeout }).catch((error: unknown) => {
      // The TimeoutError that reaches the page says nothing about which call stalled: this does.
      // Only the timeout's own abort, not the caller's.
      if (timeout.aborted && !own?.aborted) {
        const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
        log('error', 'API_TIMEOUT', { call: `${method} ${url.slice(api.length)}`, timeoutMs: API_TIMEOUT })
      }
      throw error
    })
  }
}
