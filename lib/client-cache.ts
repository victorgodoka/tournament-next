/**
 * Small in-memory client cache with a TTL (default 5 minutes), an optional
 * "permanent" mode for immutable data, and in-flight de-duplication so
 * concurrent callers share a single request. Intended for client components —
 * it lives in module scope, so keep it out of shared server request paths.
 */

export const FIVE_MINUTES = 5 * 60 * 1000

export interface CacheOptions {
  /** Time to live in ms. Ignored when `permanent` is true. Default 5 minutes. */
  ttlMs?: number
  /** Never expire — use for data that can't change (e.g. a decoded deck). */
  permanent?: boolean
}

interface CacheEntry<T> {
  value?: T
  promise?: Promise<T>
  /** Epoch ms at which a resolved value goes stale; Infinity when permanent. */
  expires: number
}

const store = new Map<string, CacheEntry<unknown>>()

const expiryFor = (options: CacheOptions, now: number) =>
  options.permanent ? Infinity : now + (options.ttlMs ?? FIVE_MINUTES)

/**
 * Return the cached value for `key` if fresh, otherwise run `fetcher`, cache
 * the result, and return it. Concurrent calls with the same key share one
 * in-flight promise. Rejected fetches are not cached.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const now = Date.now()
  const existing = store.get(key) as CacheEntry<T> | undefined

  if (existing) {
    if (existing.promise) return existing.promise
    if (existing.expires > now) return existing.value as T
  }

  const promise = fetcher()
    .then((value) => {
      store.set(key, { value, expires: expiryFor(options, Date.now()) })
      return value
    })
    .catch((error) => {
      // Only clear if this is still the in-flight entry, so a retry can run.
      const current = store.get(key)
      if (current && current.promise === promise) store.delete(key)
      throw error
    })

  store.set(key, { promise, expires: expiryFor(options, now) })
  return promise
}

/** Drop a single cache entry. */
export function invalidate(key: string): void {
  store.delete(key)
}

/**
 * Clear the whole cache, or just the entries whose key starts with `prefix`
 * (e.g. `clearCache('deck:')` to force decklists to reload).
 */
export function clearCache(prefix?: string): void {
  if (!prefix) {
    store.clear()
    return
  }

  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
