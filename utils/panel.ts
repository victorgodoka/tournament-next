/**
 * Admin panel endpoints on omega-server-v3 (see its PANEL_API.md).
 * Everything under `/panel` needs `system.manage`, runs in the browser with `credentials: 'include'`
 * and is `private, no-store` — nothing here is ever cached or read from a server component.
 *
 * The panel only controls what the panel created. `/panel/omega/*` is read-only: it finds the
 * tournament that actually ran so a schedule can be linked to it, never edits it.
 */
import { API_URL } from './auth'
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
 * Ranked analytics job (section 8) — dispatches the workflow the 01:00 run is
 * ---------------------------------------------------------------- */

export type AnalyticsRun = {
  from: string
  to: string
  /** `null` = both formats. */
  ladder: RankedLadderId | null
  /** Day being swept. The job writes this when it starts and ends, so it doesn't advance mid-run. */
  current: string | null
  done: { day: string; matches: number; rows: number; ms: number }[]
  startedAt: string
  finishedAt: string | null
  /** The run stops at the day that failed; re-run from there. */
  error: string | null
}

/** `running` is `null` when idle, and for the 1-2 minutes a dispatched runner takes to start. */
export type AnalyticsSync = { running: AnalyticsRun | null; last: AnalyticsRun | null }

/** `unavailable`: the API has no dispatch token and nothing started. Runs queue on GitHub, there is no busy. */
export type Dispatch = 'dispatched' | 'unavailable'

export const getAnalyticsSync = (signal?: AbortSignal) => request<AnalyticsSync>('/panel/analytics/sync', { signal })

/**
 * All optional: no dates is yesterday, only `from` is that single day; no `ladder` is both formats
 * (with one, the other's days stay as they were). Up to 366 days, ending today at the latest.
 */
export const startAnalyticsSync = (range: { from?: string; to?: string; ladder?: RankedLadderId }) =>
  request<{ status: Dispatch; from: string; to: string; ladder: RankedLadderId | null }>('/panel/analytics/sync', json('POST', range))

/** Every open season from its first day to yesterday, both formats. `409 NOTHING_TO_REBUILD` before any day. */
export const rebuildOpenSeasons = () => request<{ status: Dispatch; from: string; to: string }>('/panel/analytics/sync/rebuild', json('POST', {}))

/** No sweep: reclassifies the open seasons' stored decks with the rules of now and rebuilds their answers and sample decks. */
export const buildOpenSeasons = (ladder?: RankedLadderId) =>
  request<{ status: Dispatch; ladder: RankedLadderId | null }>('/panel/analytics/sync/build', json('POST', ladder ? { ladder } : {}))

/**
 * Empties the API's `/statistics` cache and warms it again in the background. A new build already does this
 * on its own; this is for what the job doesn't rewrite (a pinned cover) or anything that looks stale.
 */
export const clearStatisticsCache = () => request<{ cleared: number }>('/panel/analytics/cache/clear', json('POST', {}))

/* ---------------------------------------------------------------- *
 * Deck classification (section 9) — decks, ignored setcodes, staples
 * ---------------------------------------------------------------- */

export type PanelDeck = {
  /** Setcodes joined by `>`, lead first; `''` = Unknown. */
  key: string
  /** `null` when a code of the key has no name. */
  name: string | null
  lead: number | null
  /** The deck's game 1s. */
  decks: number
  games: number
  share: number
  players: number
}

export type DeckSetcode = {
  code: number
  name: string | null
  /** The code or its family is ignored. */
  ignored: boolean
  decks: number
  share: number
  mean: number
  min: number
  max: number
}

export type DeckSetcodes = { key: string; name: string | null; decks: number; setcodes: DeckSetcode[] }

export const listPanelDecks = (season: number, signal?: AbortSignal) =>
  request<{ decks: PanelDeck[] }>(`/panel/analytics/decks${search({ season })}`, { signal }).then((page) => page.decks)

/** `-` asks for the empty key: `''` doesn't fit in a path. */
export const getPanelDeck = (season: number, key: string, signal?: AbortSignal) =>
  request<DeckSetcodes>(`/panel/analytics/decks/${key ? encodeURIComponent(key) : '-'}${search({ season })}`, { signal })

export type Staple = {
  card: number
  /** `null`: not in the card database. */
  name: string | null
  source: 'auto' | 'manual'
  /** `false`: a manual override of an automatic one. */
  enabled: boolean
  /** The season's decks holding the card in any zone, side included, from the last build. */
  share: number | null
  /** Of those, the decks where no other card shares a setcode with it. */
  foreignShare: number | null
  /** The season's decks with it in the main or extra deck; `null` before a build has it. */
  mainShare: number | null
  /** The season's decks with it in the side deck; a deck with it in both counts in both. */
  sideShare: number | null
}

export const listStaples = (season: number, signal?: AbortSignal) =>
  request<{ staples: Staple[] }>(`/panel/staples${search({ season })}`, { signal }).then((page) => page.staples)

/** A manual decision: enables any card, or disables an automatic one. Alternate art resolves to the original. */
export const setStaple = (card: number, enabled: boolean) =>
  request<Pick<Staple, 'card' | 'source' | 'enabled'>>(`/panel/staples/${card}`, json('PUT', { enabled }))

/** Forgets the decision; the next build decides again. `404` when the card has none. */
export const resetStaple = (card: number) => request<void>(`/panel/staples/${card}`, json('DELETE'))

/* ---------------------------------------------------------------- *
 * Settings (section 10) — values staff tune without a deploy
 * ---------------------------------------------------------------- */

/**
 * How far below the leader's `wrExpected` (a rate: 0.0075 = 0.75 point) a deck may sit for each tier, the same for
 * both formats. Tier 1 is the leader and at most one more; past `t3Gap` is Tier 4. The floors are per format, in `Filters`.
 */
export type TierAnchors = { t1Gap: number; t2Gap: number; t3Gap: number }
export type Classification = { maxNames: number; stapleShare: number; stapleForeign: number }

/** What the server falls back to for a key left out. */
export const DEFAULT_TIERS: TierAnchors = { t1Gap: 0.0075, t2Gap: 0.0125, t3Gap: 0.025 }
export const DEFAULT_CLASSIFICATION: Classification = { maxNames: 3, stapleShare: 0.1, stapleForeign: 0.5 }

/** A key never written is absent. */
/** The seven tiers, lowest first; `aggregateFloor` is one of them. */
export const BAND_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Omega'] as const
/** `tierShare` (a rate) and `tierPlayers`: what a deck needs to get a tier at all, in that format. */
export type Filters = { minPlayerGames: number; minListGames: number; minKeyGames: number; eloCap: number; aggregateFloor: (typeof BAND_NAMES)[number]; tierShare: number; tierPlayers: number }
export const DEFAULT_FILTERS: Filters = { minPlayerGames: 10, minListGames: 5, minKeyGames: 30, eloCap: 3000, aggregateFloor: 'Gold', tierShare: 0.005, tierPlayers: 10 }

export const FORMATS = ['TCG', 'Genesys'] as const
export type Format = (typeof FORMATS)[number]
/** The filters are per format, each over the same defaults; a format left out keeps them all. */
export type PanelSettings = { 'analytics.tiers'?: Partial<TierAnchors>; 'analytics.classification'?: Partial<Classification>; 'analytics.filters'?: Partial<Record<Format, Partial<Filters>>> }

export const getSettings = (signal?: AbortSignal) => request<PanelSettings>('/panel/settings', { signal })

/** Keys not sent keep their value. Answers every setting after the write. */
export const updateSettings = (body: PanelSettings) => request<PanelSettings>('/panel/settings', json('PATCH', body))

/* ---------------------------------------------------------------- *
 * Public API accounts — the key itself is born in the owner's portal login
 * ---------------------------------------------------------------- */

export type ApiAccount = {
  discordId: string
  discordUsername: string
  keyPrefix: string | null
  /** Requests a minute, 1-10000. */
  rateLimit: number
  createdAt: string
  rotatedAt: string | null
  lastUsedAt: string | null
  blockedAt: string | null
}

export const listApiAccounts = (signal?: AbortSignal) =>
  request<{ accounts: ApiAccount[] }>(`/panel/api-keys${search({ limit: 200 })}`, { signal }).then((page) => page.accounts)

/** Blocking drops the key at once and stops the owner from making another. */
export const updateApiAccount = (discordId: string, body: { rateLimit?: number; blocked?: boolean }) =>
  request<ApiAccount>(`/panel/api-keys/${encodeURIComponent(discordId)}`, json('PATCH', body))

/* ---------------------------------------------------------------- *
 * Analysts (section 11.1) — `user.manage`, same shape as `/wiki/editors`
 * ---------------------------------------------------------------- */

/** Admins are listed too (they already have `analytics.write`); render them without controls. */
export const listAnalysts = async () => (await request<{ analysts: WikiEditor[] }>('/panel/analysts')).analysts

/** Exclusive role: an editor made analyst stops being editor. `404` = never signed in, `403` = admin. */
export const promoteAnalyst = (userId: string) => request<WikiEditor>(`/panel/analysts/${encodeURIComponent(userId)}`, json('PUT'))

/** Back to `USER`. */
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
 * Ignored setcodes (section 9.2): they never name a deck
 * ---------------------------------------------------------------- */

export type IgnoredArchetype = { code: number; name: string | null; updatedAt: string }

export const listIgnored = (signal?: AbortSignal) =>
  request<{ archetypes: IgnoredArchetype[] }>('/panel/ignored-archetypes', { signal }).then((page) => page.archetypes)

/** Idempotent. Answers the whole list. */
export const ignoreArchetype = (code: number) =>
  request<{ archetypes: IgnoredArchetype[] }>(`/panel/ignored-archetypes/${code}`, json('PUT')).then((page) => page.archetypes)

export const unignoreArchetype = (code: number) => request<void>(`/panel/ignored-archetypes/${code}`, json('DELETE'))

/* ---------------------------------------------------------------- *
 * Setcode covers (section 9.2.1): the card that stands for a setcode's deck
 * ---------------------------------------------------------------- */

/** `cover: null` = the automatic chain (Series cover, sample deck cover, most included card). */
export type ArchetypeCover = { code: number; name: string; cover: { id: number; name: string | null } | null }

export const listCovers = (signal?: AbortSignal) =>
  request<{ archetypes: ArchetypeCover[] }>('/panel/archetype-covers', { signal }).then((page) => page.archetypes)

/** Answers the whole list. */
export const setCover = (code: number, card: number) =>
  request<{ archetypes: ArchetypeCover[] }>(`/panel/archetype-covers/${code}`, json('PUT', { card })).then((page) => page.archetypes)

export const clearCover = (code: number) => request<void>(`/panel/archetype-covers/${code}`, json('DELETE'))

/* ---------------------------------------------------------------- *
 * Series (section 9.4): archetypes the card database does not have, made of cards
 * ---------------------------------------------------------------- */

export type SeriesCard = { id: number; name: string | null; kind: string | null }

export type Series = {
  id: number
  /** `archetype.code` when it becomes a setcode, else 65536 + id. Read-only: the API rejects it in a body. */
  code: number
  name: string
  description: string
  archetype: { code: number; name: string | null } | null
  archetypes: { code: number; name: string | null }[]
  cards: SeriesCard[]
  mentions: SeriesCard[]
  /** Pinned cover; `null` = the server's chain (first mention, most included card of the first child setcode…). */
  cover: SeriesCard | null
  updatedAt: string
}

/** Plain numbers, exactly the seven fields the API accepts. */
export type SeriesInput = { name: string; description: string; archetype: number | null; archetypes: number[]; cards: number[]; mentions: number[]; cover: number | null }

export const listSeries = (signal?: AbortSignal) => request<{ series: Series[] }>('/panel/series', { signal }).then((page) => page.series)

export const getSeries = (id: number, signal?: AbortSignal) => request<Series>(`/panel/series/${id}`, { signal })

export const createSeries = (input: SeriesInput) => request<Series>('/panel/series', json('POST', input))

/** The record is written whole: send every field. */
export const updateSeries = (id: number, input: SeriesInput) => request<Series>(`/panel/series/${id}`, json('PATCH', input))

export const deleteSeries = (id: number) => request<void>(`/panel/series/${id}`, json('DELETE'))

/** What an edit form sends back: the objects turned into numbers, `code`, `id` and `updatedAt` left out. */
export const toSeriesInput = (series: Series): SeriesInput => ({
  name: series.name,
  description: series.description,
  archetype: series.archetype?.code ?? null,
  archetypes: series.archetypes.map((a) => a.code),
  cards: series.cards.map((c) => c.id),
  mentions: series.mentions.map((c) => c.id),
  cover: series.cover?.id ?? null,
})
