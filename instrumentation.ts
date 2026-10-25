/**
 * Server-side calls to the API give up after `API_TIMEOUT`. Node's fetch otherwise waits up to
 * 300 s on a stalled API, and every render parked on it stays in the heap: one bad spell of the
 * API held enough of them to run the container out of memory.
 */
const API_TIMEOUT = 8_000

export function register() {
  const api = process.env.NEXT_PUBLIC_API_URL
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !api) return
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
    return fetch(input, { ...init, signal: own ? AbortSignal.any([own, timeout]) : timeout })
  }
}
