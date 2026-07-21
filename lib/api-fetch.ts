import { apiFailure, apiSuccess, type ApiResult } from './api-result'

type FetchJsonOptions<T> = {
  /** ISR revalidate seconds. Applied only on the server — `next` options are
   * meaningless in browser fetches, so client calls just skip it. */
  revalidate?: number
  /** Narrows the parsed body; return null to reject an unexpected shape. */
  parse: (body: unknown) => T | null
  /** User-facing message for transport, HTTP, and shape failures. */
  errorMessage: string
}

/**
 * GET a JSON endpoint into an ApiResult. Centralises the try/catch +
 * response.ok + validate dance so per-endpoint modules don't each re-implement
 * it (and drift, e.g. copy-pasted error strings).
 */
export async function fetchJson<T>(
  url: string,
  { revalidate, parse, errorMessage }: FetchJsonOptions<T>,
): Promise<ApiResult<T>> {
  try {
    const init =
      revalidate !== undefined && typeof window === 'undefined'
        ? { next: { revalidate } }
        : undefined
    const response = await fetch(url, init)

    if (!response.ok) {
      return apiFailure(errorMessage)
    }

    const body: unknown = await response.json().catch(() => null)
    const data = parse(body)

    return data === null ? apiFailure(errorMessage) : apiSuccess(data)
  } catch (error) {
    return apiFailure(error instanceof Error ? error.message : errorMessage)
  }
}
