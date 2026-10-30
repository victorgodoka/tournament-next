/**
 * Admin panel endpoints on omega-server-v3 (see its PANEL_API.md).
 * Everything under `/panel` needs `system.manage`, runs in the browser with `credentials: 'include'`
 * and is `private, no-store` — nothing here is ever cached or read from a server component.
 *
 * The panel only controls what the panel created. `/panel/omega/*` is read-only: it finds the
 * tournament that actually ran so a schedule can be linked to it, never edits it.
 */
import { API_URL } from './auth'
import type { AnalyticsPeriod } from './explorer'
import type { GlobalExploration } from './global-explorer'
import type {
  RankedLadderId,
  RankedFormat,
  WikiEditor,
} from './types'

class PanelApiError extends Error {
  status: number
  /** Stable code (`BAD_REQUEST`, `ALREADY_EXISTS`, `ALREADY_LINKED`, …). Branch on this, never on `message`. */
  code?: string
  /** Extra context some errors carry (who never signed in, which params are valid…). */
  details?: Record<string, unknown>

  constructor(status: number, code?: string, message?: string, details?: Record<string, unknown>) {
    super(message ?? `Panel API failed with ${status}`)
    this.status = status
    this.code = code
    this.details = details
  }
}

/**
 * The API's `message` names the failing field; 401/403 are said in words. Branch on `code`, never
 * on `message`.
 */
export const panelErrorText = (error: unknown) => {
  if (error instanceof PanelApiError) {
    if (error.status === 401) return 'Your session expired. Sign in again.'
    if (error.status === 403 && !error.message) return 'This account can’t do that.'
    return error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
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
type OptionValue = { value: number; name: string | null; observed: boolean }

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
    throw new PanelApiError(res.status, body.error, body.message, body.details)
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
  request<RolloverResult>('/ranked/seasons/rollover', json('POST', body))

export const renameSeason = (code: string, next: { code?: string; label?: string }) =>
  request<PanelSeason['season']>(`/ranked/seasons/${encodeURIComponent(code)}`, json('PATCH', next))

/* ---------------------------------------------------------------- *
 * Season analytics sweep (section 8) — what the 01:00 cron does, forced
 * ---------------------------------------------------------------- */

export type AnalyticsSweep = {
  from: string
  to: string
  /** `null` = both formats. */
  ladder: RankedLadderId | null
  /** Day being swept now. */
  current: string | null
  done: { day: string; matches: number; rows: number; ms: number }[]
  startedAt: string
  finishedAt: string | null
  /** The run stops at the day that failed; re-run from there. */
  error: string | null
}

/** `running` is `null` when idle; `last` is `null` after a restart. */
/** `rulesStale`: series, ignored archetypes or card groups changed since the open seasons were last rebuilt. */
export type AnalyticsSweepStatus = { running: AnalyticsSweep | null; last: AnalyticsSweep | null; rulesStale: boolean }

/** Sweeps the open seasons from their first day to yesterday. `409 BUSY` while one runs, `409 NOTHING_TO_REBUILD` before any day. */
export const rebuildOpenSeasons = () =>
  request<{ status: 'started'; from: string; to: string }>('/panel/analytics/sync/rebuild', json('POST', {}))

/**
 * All optional: no dates is yesterday, only `from` is that single day; no `ladder` is both formats
 * (with one, the other's days stay as they were). `409 BUSY` while one runs.
 */
export const startAnalyticsSweep = (range: { from?: string; to?: string; ladder?: RankedLadderId }) =>
  request<{ status: 'started'; from: string; to: string; ladder: RankedLadderId | null }>('/panel/analytics/sync', json('POST', range))

/** A ranked season and its /statistics freeze. `lastDay` (job zone) is `null` while open; `frozenAt` `null` while live. */
export type StatisticsSeason = {
  code: string
  label: string
  ladder: RankedLadderId
  startsAt: string
  endsAt: string | null
  lastDay: string | null
  frozenAt: string | null
}

export const listStatisticsSeasons = (signal?: AbortSignal) =>
  request<StatisticsSeason[]>('/panel/analytics/statistics/seasons', { signal })

export const getAnalyticsSweep = (signal?: AbortSignal) =>
  request<AnalyticsSweepStatus>('/panel/analytics/sync', { signal })

/** Recomputes the whole season for one player, today included, and waits. No `season` = every open season. */
export const syncPlayerAnalytics = (playerId: string, season?: string) =>
  request<{ playerId: string; seasons: { code: string; matches: number; days: number }[]; ms: number }>(
    `/panel/analytics/players/${encodeURIComponent(playerId)}/sync`,
    json('POST', season ? { season } : {}),
  )

/* ---------------------------------------------------------------- *
 * Analytics periods — any window, a segment next to the seasons
 * ---------------------------------------------------------------- */

/** `code` is what explorations store: never change it once saved. ISO dates, `endsAt` exclusive. */
export type PeriodBody = { code?: string; label: string; ladder: RankedLadderId; startsAt: string; endsAt: string }

export type PanelPeriod = AnalyticsPeriod & { id: number; createdBy: string | null; createdAt: string }

/** The global sweep over the period's days: `null` when it starts in the future or only the name changed. */
export type PeriodBackfill = { status: 'started' | 'busy'; from: string; to: string } | null

export const listPanelPeriods = (signal?: AbortSignal) =>
  request<{ periods: PanelPeriod[] }>('/panel/analytics/periods', { signal }).then((page) => page.periods)

/** `409 CODE_TAKEN` when a season or another period has the code. */
export const createPeriod = (body: PeriodBody) =>
  request<PanelPeriod & { backfill: PeriodBackfill }>('/panel/analytics/periods', json('POST', body))

export const updatePeriod = (id: number, body: Partial<PeriodBody>) =>
  request<PanelPeriod & { backfill: PeriodBackfill }>(`/panel/analytics/periods/${id}`, json('PATCH', body))

/** Drops its global data too. */
export const deletePeriod = (id: number) => request<void>(`/panel/analytics/periods/${id}`, json('DELETE'))

/* ---------------------------------------------------------------- *
 * Global explorations (section 8.4) — staff-built, draft or public
 * ---------------------------------------------------------------- */

export type GlobalExplorationBody = Partial<Pick<GlobalExploration, 'name' | 'description' | 'position' | 'published' | 'config'>>

/** Drafts and published, in `position` order. */
export const listPanelExplorations = (signal?: AbortSignal) =>
  request<{ explorations: GlobalExploration[] }>('/panel/analytics/explorations', { signal }).then((page) => page.explorations)

/** Needs `name` and `config`. `400 INVALID_EXPLORATION` names the broken builder rule. */
export const createPanelExploration = (body: GlobalExplorationBody) =>
  request<GlobalExploration>('/panel/analytics/explorations', json('POST', body))

/** Only the fields sent change. `published: true` keeps the first publish date; `false` is back to draft. */
export const updatePanelExploration = (id: string, body: GlobalExplorationBody) =>
  request<GlobalExploration>(`/panel/analytics/explorations/${encodeURIComponent(id)}`, json('PATCH', body))

export const deletePanelExploration = (id: string) =>
  request<void>(`/panel/analytics/explorations/${encodeURIComponent(id)}`, json('DELETE'))

/* ---------------------------------------------------------------- *
 * Settings (section 10) — values staff tune without a deploy
 * ---------------------------------------------------------------- */

export type PanelSettings = {
  /** A global-analytics cut with fewer deck-samples than this is hidden. `0` shows everything. */
  'analytics.global.minSamples': number
}

export const getSettings = (signal?: AbortSignal) => request<PanelSettings>('/panel/settings', { signal })

/** Keys not sent keep their value. Answers every setting after the write. */
export const updateSettings = (body: Partial<PanelSettings>) => request<PanelSettings>('/panel/settings', json('PATCH', body))

/* ---------------------------------------------------------------- *
 * Card categories (section 9) — engine, tech, hand trap
 * ---------------------------------------------------------------- */

export type CardGroupKind = 'engine' | 'tech'

export type CardGroup = {
  id: number
  kind: CardGroupKind
  name: string
  description: string
  /** Only ever `true` on a tech group. */
  handTrap: boolean
  /** Engine only: deck archetypes where this is NOT engine. */
  exceptions: { code: number; name: string }[]
  /** Canonical ids. `name`/`kind` are `null` once the card left the card database. */
  cards: { id: number; name: string | null; kind: 'monster' | 'spell' | 'trap' | null }[]
  /** The card that stands for the group (one of `cards`); `null` = the first card of the list. */
  cover: number | null
  updatedAt: string
}

/** `exceptions` and `cards` also accept the objects the GET returns, so a form can send back what it read. */
export type CardGroupBody = {
  kind?: CardGroupKind
  name?: string
  description?: string
  handTrap?: boolean
  exceptions?: number[]
  /** Replaces the list. Alt-art passcodes are saved as the original; duplicates collapse. */
  cards?: number[]
  /** One of `cards`; `null` clears it (the first card is the cover then). */
  cover?: number | null
}

export const listCardGroups = (signal?: AbortSignal) =>
  request<{ groups: CardGroup[] }>('/panel/card-groups', { signal }).then((page) => page.groups)

export const createCardGroup = (body: CardGroupBody) => request<CardGroup>('/panel/card-groups', json('POST', body))

/** Merged over the current group. Switching `kind` drops what doesn't belong to the new one. */
export const updateCardGroup = (id: number, body: CardGroupBody) =>
  request<CardGroup>(`/panel/card-groups/${id}`, json('PATCH', body))

export const deleteCardGroup = (id: number) => request<void>(`/panel/card-groups/${id}`, json('DELETE'))

/* ---------------------------------------------------------------- *
 * Analysts (section 11.1) — `user.manage`, same shape as `/wiki/editors`
 * ---------------------------------------------------------------- */

/** Admins are listed too (they already have `analytics.write`); render them without controls. */
export const listAnalysts = async () => (await request<{ analysts: WikiEditor[] }>('/panel/analysts')).analysts

/** Exclusive role: an editor made analyst stops being editor. `404` = never signed in, `403` = admin. */
export const promoteAnalyst = (userId: string) => request<WikiEditor>(`/panel/analysts/${encodeURIComponent(userId)}`, json('PUT'))

/** Back to `USER`; their explorations stay. */
export const demoteAnalyst = (userId: string) => request<void>(`/panel/analysts/${encodeURIComponent(userId)}`, json('DELETE'))

const seg = encodeURIComponent

/* ---------------------------------------------------------------- *
 * Activity log (section 12) — read-only, the server records everything
 * ---------------------------------------------------------------- */

export type AuditOutcome = 'success' | 'denied' | 'rejected' | 'error'
export type AuditEntry = {
  id: string
  at: string
  actor: { id: string; role: string; username: string | null; avatarUrl: string | null }
  action: string
  method: string
  route: string
  params: Record<string, string>
  query: Record<string, string>
  target: string | null
  status: number
  outcome: AuditOutcome
  error: string | null
  durationMs: number
  /** Only on `getAuditEntry`. Untrusted: render as text, never HTML. */
  body?: unknown
}
export type AuditQuery = {
  actor?: string
  /** Exact, or a prefix by segment (`panel.tournaments`). */
  action?: string
  outcome?: AuditOutcome
  target?: string
  from?: string
  to?: string
  cursor?: string
  limit?: number
}

export const listAudit = (query: AuditQuery = {}, signal?: AbortSignal) =>
  request<{ entries: AuditEntry[]; nextCursor: string | null }>(`/panel/audit${search(query)}`, { signal })

export const getAuditEntry = (id: string, signal?: AbortSignal) => request<AuditEntry>(`/panel/audit/${seg(id)}`, { signal })

export const listAuditActions = (signal?: AbortSignal) =>
  request<{ actions: { action: string; method: string; route: string }[] }>('/panel/audit/actions', { signal }).then(
    (page) => page.actions,
  )

/* ---------------------------------------------------------------- *
 * Series and ignored archetypes (sections 9.2, 9.3)
 * ---------------------------------------------------------------- */

type CardRef = CardGroup['cards'][number]

export type Series = {
  id: number
  /** Archetype code in the stats: the overridden setcode, or 65536 + id. */
  code: number
  name: string
  description: string
  archetype: { code: number; name: string | null } | null
  mode: 'extend' | 'replace'
  archetypes: { code: number; name: string | null; keep: boolean }[]
  cards: CardRef[]
  mentions: CardRef[]
  /** The pinned cover, any card. null: first mention, then most included of the first child, of the overridden setcode, first card. */
  cover: CardRef | null
  updatedAt: string
  /** `GET /panel/series/{id}` only: what it takes today, direct + resolved mentions. */
  members?: CardRef[]
}

export type SeriesBody = {
  name?: string
  description?: string
  archetype?: number | null
  mode?: 'extend' | 'replace'
  archetypes?: { code: number; keep: boolean }[]
  cards?: number[]
  mentions?: number[]
  cover?: number | null
}

export const listSeries = (signal?: AbortSignal) =>
  request<{ series: Series[] }>('/panel/series', { signal }).then((page) => page.series)

export const getSeries = (id: number, signal?: AbortSignal) => request<Series>(`/panel/series/${id}`, { signal })

export const createSeries = (body: SeriesBody) => request<Series>('/panel/series', json('POST', body))

export const updateSeries = (id: number, body: SeriesBody) => request<Series>(`/panel/series/${id}`, json('PATCH', body))

export const deleteSeries = (id: number) => request<void>(`/panel/series/${id}`, json('DELETE'))

export type IgnoredArchetype = { code: number; name: string | null; updatedAt: string }

export const listIgnored = (signal?: AbortSignal) =>
  request<{ archetypes: IgnoredArchetype[] }>('/panel/ignored-archetypes', { signal }).then((page) => page.archetypes)

/** Idempotent. Answers the whole list. */
export const ignoreArchetype = (code: number) =>
  request<{ archetypes: IgnoredArchetype[] }>(`/panel/ignored-archetypes/${code}`, json('PUT')).then((page) => page.archetypes)

export const unignoreArchetype = (code: number) => request<void>(`/panel/ignored-archetypes/${code}`, json('DELETE'))
