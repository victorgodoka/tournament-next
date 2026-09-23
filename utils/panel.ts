/**
 * Admin panel endpoints on omega-server-v3 (see its PANEL_API.md).
 * Everything under `/panel` needs `system.manage`, runs in the browser with `credentials: 'include'`
 * and is `private, no-store` — nothing here is ever cached or read from a server component.
 *
 * The panel only controls what the panel created. `/panel/omega/*` is read-only: it finds the
 * tournament that actually ran so a schedule can be linked to it, never edits it.
 */
import { API_URL } from './auth'
import type { RankedLadderId, RankedFormat } from './types'

export class PanelApiError extends Error {
  status: number
  /** Stable code (`BAD_REQUEST`, `ALREADY_EXISTS`, `ALREADY_LINKED`, …). Branch on this, never on `message`. */
  code?: string

  constructor(status: number, code?: string, message?: string) {
    super(message ?? `Panel API failed with ${status}`)
    this.status = status
    this.code = code
  }
}

/* ---------------------------------------------------------------- *
 * Shapes
 * ---------------------------------------------------------------- */

export type PanelFormat = {
  id: number
  name: string
  /**
   * Resolved from the card database (omega.db); never accepted from a body. The name is also what
   * the game writes into `tournament.banlist`, so searching by `formatId` uses it directly.
   */
  banlist: { id: number; name: string } | null
  description: string | null
  /** Booster release dates, `YYYY-MM-DD`. `null` on either end means any date goes. */
  relFrom: string | null
  relUntil: string | null
  /** List response only: how many scheduled tournaments came from this format. */
  tournaments?: number
}

export type FormatBody = {
  name?: string
  banlistId?: number | null
  description?: string | null
  relFrom?: string | null
  relUntil?: string | null
}

export type OmegaTournament = {
  id: number
  status: 'live' | 'finished'
  banlist: string | null
  format: string | null
  players: number
  rounds: number
  startedAt: string | null
  endedAt: string | null
  cardPool: { releasedFrom: string | null; releasedUntil: string | null }
  settings: Record<string, string | number | boolean | null>
  extraRules: { raw: string; bits: number[] }
  /** The schedule id that already claimed it, or `null`. Show it so the admin doesn't eat a `409`. */
  linkedTo: number | null
}

export type ScheduledTournament = {
  id: number
  /** Rendered by the server, pasted into the game client. Never rebuild it — the 16-argument order is the contract. */
  command: string
  omegaTournamentId: number | null
  /** `null` while unlinked, and also when the linked row disappeared from the Omega MySQL. */
  omega: OmegaTournament | null
  format: { id: number; name: string } | null
  formatId: number | null
  startsAt: string
  banlistId: number
  banlistName: string | null
  mode: number
  masterRule: number
  region: number
  timer: number
  drawCount: number
  startHand: number
  startLp: number
  duelRule: number
  relFrom: string | null
  relUntil: string | null
  /** `uint64` bitmask as a string: above 2^53 a JS number loses precision. */
  extraRules: string
  /** Integer of cents. Never reais, never a float. */
  budgetCents: number
  requiresPass: boolean
  rewardTp: boolean
  tournyMode: number
  createdBy: string
  createdAt: string
}

/** Read-only fields are dropped by the server, so a form can round-trip the object it read. */
export type TournamentBody = Partial<
  Pick<
    ScheduledTournament,
    | 'formatId' | 'startsAt' | 'banlistId' | 'mode' | 'masterRule' | 'region' | 'timer' | 'drawCount'
    | 'startHand' | 'startLp' | 'duelRule' | 'relFrom' | 'relUntil' | 'extraRules' | 'budgetCents'
    | 'requiresPass' | 'rewardTp' | 'tournyMode'
  >
>

export type OmegaBanlist = { banlist: string; tournaments: number; firstAt: string; lastAt: string }

/** `name: null` is a valid value nobody knows the name of — show the number. `observed`: some tournament used it. */
export type OptionValue = { value: number; name: string | null; observed: boolean }

export type PanelOptions = {
  /** omega.db lists, the only source with the retro ones. */
  banlists: { id: number; name: string; tournaments: number }[]
  /** Lists the game still has tournaments on but that rotated out of the card database. */
  banlistsNotInCardDb: { name: string; tournaments: number }[]
  formats: PanelFormat[]
  modes: OptionValue[]
  regions: OptionValue[]
  /** Value `N` is Master Rule `N`; build the label client-side. */
  masterRules: OptionValue[]
  duelRules: OptionValue[]
  tournyModes: OptionValue[]
  /** Bit combinations real tournaments use, newest first. Send `value` back as `extraRules`. */
  extraRulesPresets: { value: string; bits: number[]; banlists: string[]; tournaments: number }[]
  /** Same table the validator uses. `required: false` means the field has a default. */
  ranges: Record<string, { min: number; max: number; required: boolean }>
}

export type OmegaQuery = {
  /** Exact lookup. Ignores every other filter. */
  id?: number
  banlist?: string
  formatId?: number
  from?: string
  to?: string
  status?: 'live' | 'finished'
  unlinked?: boolean
  cursor?: string
  limit?: number
}

export type PanelSeason = {
  ladder: RankedLadderId
  format: RankedFormat
  season: {
    id: number
    code: string
    label: string
    ordinal: number
    startsAt: string
    standings: number
    /** Newest `synced_at` in the snapshot. `null` when `standings` is `0`. */
    syncedAt: string | null
  } | null
}

export type SyncResult = { status: 'synced' | 'busy'; day: string; duelists: number; standings: number; ms: number }

export type RolloverResult = {
  ladder: RankedLadderId
  format: RankedFormat
  closed: { id: number; code: string; label: string; ordinal: number; standings: number }
  opened: { id: number; code: string; label: string; ordinal: number }
}

/* ---------------------------------------------------------------- *
 * Transport
 * ---------------------------------------------------------------- */

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', cache: 'no-store', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new PanelApiError(res.status, body.error, body.message)
  }
  // `DELETE` answers 204; nothing to parse.
  return res.status === 204 ? (undefined as T) : res.json()
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})

const search = (query: Record<string, string | number | boolean | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Everything the tournament form needs in one call: banlists, formats, and the valid value of every field. */
export const getOptions = (signal?: AbortSignal) => request<PanelOptions>('/panel/options', { signal })

/* ---------------------------------------------------------------- *
 * Formats — a catalog so the same banlist and card window aren't retyped
 * ---------------------------------------------------------------- */

export const listFormats = (signal?: AbortSignal) =>
  request<{ formats: PanelFormat[] }>('/panel/formats', { signal }).then((page) => page.formats)

export const createFormat = (body: FormatBody) => request<PanelFormat>('/panel/formats', json('POST', body))

/** A real patch: absent fields keep their current value. */
export const updateFormat = (id: number, body: FormatBody) =>
  request<PanelFormat>(`/panel/formats/${id}`, json('PATCH', body))

/** The tournaments made from it survive; they only lose `format` (their 16 parameters are on their own row). */
export const deleteFormat = (id: number) => request<void>(`/panel/formats/${id}`, json('DELETE'))

/* ---------------------------------------------------------------- *
 * Scheduled tournaments — ours, in Postgres, fully editable
 * ---------------------------------------------------------------- */

/** `upcoming` defaults to `true` (soonest first); `false` lists everything, newest first. */
export const listTournaments = (query: { upcoming?: boolean; limit?: number } = {}, signal?: AbortSignal) =>
  request<{ tournaments: ScheduledTournament[] }>(`/panel/tournaments${search(query)}`, { signal }).then(
    (page) => page.tournaments,
  )

export const createTournament = (body: TournamentBody) =>
  request<ScheduledTournament>('/panel/tournaments', json('POST', body))

/** The body is merged over the current row and validated as a whole; `command` is recomputed on every write. */
export const updateTournament = (id: number, body: TournamentBody) =>
  request<ScheduledTournament>(`/panel/tournaments/${id}`, json('PATCH', body))

export const deleteTournament = (id: number) => request<void>(`/panel/tournaments/${id}`, json('DELETE'))

/* ---------------------------------------------------------------- *
 * Linking a schedule to the tournament that actually ran
 * ---------------------------------------------------------------- */

/** The banlists that actually have tournaments in the game, for the `?banlist=` filter. */
export const listOmegaBanlists = (signal?: AbortSignal) =>
  request<{ banlists: OmegaBanlist[] }>('/panel/omega/banlists', { signal }).then((page) => page.banlists)

/** `nextCursor` paginates the raw page, before `unlinked` filtering — a short page isn't the end. */
export const listOmegaTournaments = (query: OmegaQuery = {}, signal?: AbortSignal) =>
  request<{ tournaments: OmegaTournament[]; nextCursor: string | null }>(`/panel/omega/tournaments${search(query)}`, {
    signal,
  })

/** Idempotent: re-linking the same id answers `200`, so a double-click is safe. */
export const linkOmega = (id: number, omegaTournamentId: number) =>
  request<ScheduledTournament>(`/panel/tournaments/${id}/omega`, json('PUT', { omegaTournamentId }))

export const unlinkOmega = (id: number) => request<void>(`/panel/tournaments/${id}/omega`, json('DELETE'))

/* ---------------------------------------------------------------- *
 * Ranked operations (section 6) — same gate, still on their own prefix
 * ---------------------------------------------------------------- */

export const listSeasons = (signal?: AbortSignal) =>
  request<{ seasons: PanelSeason[] }>('/ranked/seasons', { signal }).then((page) => page.seasons)

/** Exactly what the nightly cron runs. `status: 'busy'` means another run holds the lock. */
export const syncRanked = () => request<SyncResult>('/ranked/sync', json('POST'))

/** `season` is the ordinal you believe is open — a guard against a double-click, not a selector. */
export const rolloverSeason = (body: { ladder: RankedLadderId; season?: number; label?: string; code?: string }) =>
  request<RolloverResult>('/ranked/season/rollover', json('POST', body))

export const renameSeason = (code: string, next: { code?: string; label?: string }) =>
  request<PanelSeason['season']>(`/ranked/seasons/${encodeURIComponent(code)}`, json('PATCH', next))
