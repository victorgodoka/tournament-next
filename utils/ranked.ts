/**
 * Ranked ladder endpoints on omega-server-v3 (see its RANKED_API.md).
 * The leaderboard and the past-season archive are public. The leaderboard refresh is
 * `system.manage`; seasons, sync and rollover belong to the admin panel, not to this page.
 */
import { API_URL } from '@utils/auth'
import type { LeaderboardPage, PastSeasons, RankedFormat, RankedLadderId } from '@utils/types'

export class RankedApiError extends Error {
  status: number
  /** Stable code (`BAD_REQUEST`, ...). Branch on this, never on `message`. */
  code?: string

  constructor(status: number, code?: string, message?: string) {
    super(message ?? `Ranked API failed with ${status}`)
    this.status = status
    this.code = code
  }
}

/** The two ladders, in the order the API always lists them. There is no OCG queue and no combined board. */
export const LADDERS: { id: RankedLadderId; format: RankedFormat }[] = [
  { id: 'tcg', format: 'TCG' },
  { id: 'genesys', format: 'Genesys' },
]

/** The API defaults to 25 and caps at 100. One screen of the ledger is worth more than 25. */
export const LEADERBOARD_PAGE_SIZE = 50

const fail = async (res: Response) => {
  const body = await res.json().catch(() => ({}))
  return new RankedApiError(res.status, body.error, body.message)
}

/**
 * `revalidate` mirrors the endpoint's own cache window; it is ignored on client-side calls.
 * `reload` skips the browser cache — the only way to see a fresh read right after an admin refresh.
 */
const get = async <T>(path: string, revalidate: number, { signal, reload }: { signal?: AbortSignal; reload?: boolean } = {}) => {
  const res = await fetch(`${API_URL}${path}`, reload ? { cache: 'reload', signal } : { next: { revalidate }, signal })
  if (!res.ok) throw await fail(res)
  return res.json() as Promise<T>
}

type PageQuery = { cursor?: string; limit?: number; reload?: boolean }

const pageParams = (cursor: string | undefined, limit: number, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams({ ...extra, limit: String(limit) })
  if (cursor) params.set('cursor', cursor)
  return params
}

/**
 * The open season of one ladder, read live from the game server and cached there for 30 minutes.
 * Pass `nextCursor` back as `cursor`; it is a rank, never an offset.
 *
 * A profile reads `elo` on every request, so it can be up to 30 minutes ahead of this list.
 */
export const getLeaderboard = (
  ladder: RankedLadderId,
  { cursor, limit = LEADERBOARD_PAGE_SIZE, reload }: PageQuery = {},
  signal?: AbortSignal,
) => get<LeaderboardPage>(`/ranked/leaderboard?${pageParams(cursor, limit, { ladder })}`, 300, { signal, reload })

/** Closed seasons of one ladder, newest first. Empty until the ladder closes its first season. */
export const getPastSeasons = (ladder: RankedLadderId) =>
  get<PastSeasons>(`/ranked/seasons/past?ladder=${ladder}`, 300)

/** `system.manage`. Re-reads both ladders now; re-fetch them with `reload` afterwards. */
export const refreshLeaderboard = async () => {
  const res = await fetch(`${API_URL}/ranked/leaderboard/refresh`, { method: 'POST', credentials: 'include' })
  if (!res.ok) throw await fail(res)
  return res.json() as Promise<{ readAt: string; tcg: number; genesys: number }>
}
