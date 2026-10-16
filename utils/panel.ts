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
  ShopEnum,
  ShopEquippedItem,
  ShopInventoryItem,
  ShopItem,
  ShopLedgerEntry,
  WikiEditor,
} from './types'

export class PanelApiError extends Error {
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
  /** Day being swept now. */
  current: string | null
  done: { day: string; matches: number; rows: number; ms: number }[]
  startedAt: string
  finishedAt: string | null
  /** The run stops at the day that failed; re-run from there. */
  error: string | null
}

/** `running` is `null` when idle; `last` is `null` after a restart. */
export type AnalyticsSweepStatus = { running: AnalyticsSweep | null; last: AnalyticsSweep | null }

/** Both optional: no body is yesterday, only `from` is that single day. `409 BUSY` while one runs. */
export const startAnalyticsSweep = (range: { from?: string; to?: string }) =>
  request<{ status: 'started'; from: string; to: string }>('/panel/analytics/sync', json('POST', range))

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

/* ---------------------------------------------------------------- *
 * Shop catalog (section 7) — what used to live in the spreadsheet
 * ---------------------------------------------------------------- */

export type ShopEnumKind = 'type' | 'category'
export type PanelShopEnum = ShopEnum & { kind: ShopEnumKind }
export type ShopPrice = { type: string; basePrice: number }
/** The key comes from the URL; `price` is never written (base × multiplier, computed on read). */
/** `assetUrl` is derived from `assetId`; `description`, `assetId`, `data`, `active`: omitted = unchanged, `null` clears. */
export type ShopItemBody = Omit<ShopItem, 'id' | 'price' | 'assetUrl'>
export type BattlepassTrack = 'free' | 'premium'
/** `item` is the whole item, same shape as the items list. */
export type BattlepassReward = { season: string; level: number; premium: boolean; itemId: string; qty: number; item: ShopItem }
export type ShopImportResult = { written: number; warnings: string[] }
export type ShopTab = 'enums' | 'prices' | 'items' | 'battlepass'

const seg = encodeURIComponent

export const listShopEnums = (signal?: AbortSignal) =>
  request<{ enums: PanelShopEnum[] }>('/panel/shop/enums', { signal }).then((page) => page.enums)

/** `equippable`, `surfaces`, `currency`: only on a `type`; omitted = unchanged. */
export type ShopEnumBody = { name: string; description: string } & Partial<Pick<ShopEnum, 'equippable' | 'surfaces' | 'currency'>>

export const saveShopEnum = (kind: ShopEnumKind, value: string, body: ShopEnumBody) =>
  request<PanelShopEnum>(`/panel/shop/enums/${kind}/${seg(value)}`, json('PUT', body))

/** `409 IN_USE` while an item or a base price still uses it. */
export const deleteShopEnum = (kind: ShopEnumKind, value: string) =>
  request<void>(`/panel/shop/enums/${kind}/${seg(value)}`, json('DELETE'))

export const listShopPrices = (signal?: AbortSignal) =>
  request<{ prices: ShopPrice[] }>('/panel/shop/prices', { signal }).then((page) => page.prices)

/** Reprices every item of the type at once. */
export const saveShopPrice = (type: string, basePrice: number) =>
  request<ShopPrice>(`/panel/shop/prices/${seg(type)}`, json('PUT', { basePrice }))

export const deleteShopPrice = (type: string) => request<void>(`/panel/shop/prices/${seg(type)}`, json('DELETE'))

/** The admin view: includes items out of their window and outside `SHOP`. */
export const listShopItems = (signal?: AbortSignal) =>
  request<{ items: ShopItem[] }>('/panel/shop/items', { signal }).then((page) => page.items)

/** `201` with a generated 8-hex id. `409 ALREADY_EXISTS` is a collision: retry. */
export const createShopItem = (body: ShopItemBody) => request<ShopItem>('/panel/shop/items', json('POST', body))

export const saveShopItem = (id: string, body: ShopItemBody) =>
  request<ShopItem>(`/panel/shop/items/${seg(id)}`, json('PUT', body))

export const deleteShopItem = (id: string) => request<void>(`/panel/shop/items/${seg(id)}`, json('DELETE'))

export const listBattlepass = (season?: string, signal?: AbortSignal) =>
  request<{ rewards: BattlepassReward[] }>(`/panel/shop/battlepass${search({ season })}`, { signal }).then(
    (page) => page.rewards,
  )

const rewardPath = (season: string, level: number, track: BattlepassTrack) =>
  `/panel/shop/battlepass/${seg(season)}/${level}/${track}`

export const saveReward = (season: string, level: number, track: BattlepassTrack, body: { itemId: string; qty: number }) =>
  request<BattlepassReward>(rewardPath(season, level, track), json('PUT', body))

export const deleteReward = (season: string, level: number, track: BattlepassTrack) =>
  request<void>(rewardPath(season, level, track), json('DELETE'))

/**
 * The tab's CSV as exported from the spreadsheet, raw. One transaction: a bad row is a `400` naming
 * it and nothing is written. Rows missing from the file are not deleted.
 */
export const importShopCsv = (tab: ShopTab, csv: string, season?: string) =>
  request<ShopImportResult>(`/panel/shop/${tab}/import${search({ season })}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv' },
    body: csv,
  })

/* ---------------------------------------------------------------- *
 * Item assets (section 7.4) — the browser uploads straight to Cloudinary
 * ---------------------------------------------------------------- */

/** Same shape as the wiki upload. POST the file to `uploadUrl` with every `fields` entry, then save `public_id` as `assetId`. */
export const signShopAsset = () =>
  request<{ uploadUrl: string; fields: Record<string, string> }>('/panel/shop/assets/sign', json('POST'))

/* ---------------------------------------------------------------- *
 * Rewards (section 7.5) — give, revoke, refund
 * ---------------------------------------------------------------- */

export type ItemSource = ShopInventoryItem['source']
export type LedgerEntry = ShopLedgerEntry
export type GrantLogEntry = {
  id: string
  userId: string
  itemId: string
  itemName: string
  qty: number
  kind: 'reward' | 'battlepass' | 'revoke' | 'refund'
  note: string | null
  actorId: string | null
  createdAt: string
}
/** `nextCursor` still comes back on an exactly-full last page: stop on `null` or on `entries: []`. */
export type CursorPage<T> = { entries: T[]; nextCursor: string | null }
export type GrantResult = {
  dryRun: boolean
  granted: number
  alreadyOwned: number
  results: { userId: string; itemId: string; currency: boolean; granted: boolean }[]
}
export type UserShop = {
  userId: string
  balance: number
  items: ShopInventoryItem[]
  equipped: Record<string, ShopEquippedItem>
  ledger: CursorPage<LedgerEntry>
  grants: CursorPage<GrantLogEntry>
}

/** One transaction for 1–500 duelists. `404` lists who never signed in; `qty` > 1 only for a currency item. */
export const grantReward = (body: { userIds: string[]; itemId: string; qty?: number; note?: string }, dryRun = false) =>
  request<GrantResult>(`/panel/rewards/grant${search({ dryRun: dryRun || undefined })}`, json('POST', body))

/** CSV `user_id,item_id,qty,note`, up to 5000 lines. */
export const importRewards = (csv: string, dryRun = false) =>
  request<GrantResult>(`/panel/rewards/import${search({ dryRun: dryRun || undefined })}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/csv' },
    body: csv,
  })

export const listRewardsLog = (query: { userId?: string; cursor?: string } = {}, signal?: AbortSignal) =>
  request<CursorPage<GrantLogEntry>>(`/panel/rewards/log${search(query)}`, { signal })

/** `404` for a duelist who never signed in. */
export const getUserShop = (userId: string, signal?: AbortSignal) =>
  request<UserShop>(`/panel/users/${seg(userId)}/shop`, { signal })

export const listUserLedger = (userId: string, cursor?: string, signal?: AbortSignal) =>
  request<CursorPage<LedgerEntry>>(`/panel/users/${seg(userId)}/ledger${search({ cursor })}`, { signal })

/** Empties the slot it was equipped in. */
export const revokeItem = (userId: string, itemId: string, note?: string) =>
  request<void>(`/panel/users/${seg(userId)}/items/${seg(itemId)}${search({ note })}`, json('DELETE'))

/** Gives back what this ownership cost, not today's price. `409 NOT_PURCHASED` for a reward or battlepass item. */
export const refundItem = (userId: string, itemId: string, note?: string) =>
  request<{ refunded: number; balance: number }>(
    `/panel/users/${seg(userId)}/items/${seg(itemId)}/refund`,
    json('POST', note ? { note } : {}),
  )

/** `Idempotency-Key`: one UUID per click, so a retry never credits twice. `409 NEGATIVE_BALANCE`, `404` never signed in. */
export const creditWallet = (userId: string, amount: number, key: string, note?: string) =>
  request<{ balance: number }>(`/shop/wallets/${seg(userId)}/credit`, {
    ...json('POST', { amount, ...(note ? { note } : {}) }),
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  })

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
  /** Exact, or a prefix by segment (`panel.shop`). */
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
 * Battlepass (section 7.6) — seasons, XP curve and rules, players
 * ---------------------------------------------------------------- */

export type XpSource = 'ranked_win' | 'ranked_loss' | 'ranked_draw' | 'tournament_entry' | 'tournament_match_win' | 'daily_login'
export type XpRules = Partial<Record<XpSource, number>>
export type PassFormat = 'TCG' | 'Genesys'

export type BattlepassSeason = {
  code: string
  name: string
  description: string
  startsAt: string
  endsAt: string
  /** Visible to players and claimable, also after `endsAt`. */
  active: boolean
  xpPerLevel: number
  formats: PassFormat[]
  premiumOmegaPass: boolean
  /** Duel Points for the premium track on the site; `null` = not sold. */
  premiumPrice: number | null
  lastDuelId: string | null
  lastTournamentId: number | null
  syncedAt: string | null
  createdAt: string
  updatedAt: string
  stats?: { participants: number; premium: number; claims: number }
}

export type SeasonBody = Partial<
  Pick<BattlepassSeason, 'name' | 'description' | 'startsAt' | 'endsAt' | 'active' | 'xpPerLevel' | 'formats' | 'premiumOmegaPass' | 'premiumPrice'>
> & { code?: string }

/** The effective curve 1..max: a stored row's `xp`, else `level × xpPerLevel`. */
export type TrackLevel = { level: number; xp: number; free: BattlepassReward | null; premium: BattlepassReward | null }

export type BattlepassSeasonDetail = BattlepassSeason & {
  stats: { participants: number; premium: number; claims: number }
  xpRules: XpRules
  /** Only the stored curve rows. */
  levels: { level: number; xp: number }[]
  track: TrackLevel[]
}

export type TrackImportResult = {
  dryRun: boolean
  mode: 'upsert' | 'replace'
  levels: number
  rewards: number
  removed: { rewards: number; levels: number }
  warnings: string[]
}

export type PassProgress = {
  userId: string
  xp: number
  level: number
  webPremium: boolean
  premium: boolean
  /** `web`: given on the site (panel or bought); `omega_pass`: the game's pass, read live. */
  premiumSource: 'web' | 'omega_pass' | null
  claimed: { level: number; track: BattlepassTrack; itemId: string; qty: number; claimedAt: string }[]
}

const pass = (code: string) => `/panel/battlepass/seasons/${seg(code)}`

export const listPassSeasons = (signal?: AbortSignal) =>
  request<{ seasons: BattlepassSeason[] }>('/panel/battlepass/seasons', { signal }).then((page) => page.seasons)

/** `409 ALREADY_EXISTS` on a taken code. */
export const createPassSeason = (body: SeasonBody) => request<BattlepassSeason>('/panel/battlepass/seasons', json('POST', body))

export const getPassSeason = (code: string, signal?: AbortSignal) => request<BattlepassSeasonDetail>(pass(code), { signal })

export const updatePassSeason = (code: string, body: SeasonBody) => request<BattlepassSeason>(pass(code), json('PATCH', body))

/** `409 IN_USE` once anyone claimed a reward: set `active: false` instead. */
export const deletePassSeason = (code: string) => request<void>(pass(code), json('DELETE'))

/** `xp` is the total to reach the level. */
export const savePassLevel = (code: string, level: number, xp: number) =>
  request<{ level: number; xp: number }>(`${pass(code)}/levels/${level}`, json('PUT', { xp }))

export const deletePassLevel = (code: string, level: number) => request<void>(`${pass(code)}/levels/${level}`, json('DELETE'))

/** Replaces every rule; a source left out gives 0. */
export const savePassRules = (code: string, rules: XpRules) => request<XpRules>(`${pass(code)}/xp-rules`, json('PUT', rules))

/** `level,xp,track,item_id,qty`, one transaction. `replace` also deletes rows missing from the file (never a claimed one). */
export const importPassTrack = (code: string, csv: string, opts: { dryRun?: boolean; replace?: boolean } = {}) =>
  request<TrackImportResult>(
    `${pass(code)}/import${search({ dryRun: opts.dryRun || undefined, mode: opts.replace ? 'replace' : undefined })}`,
    { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: csv },
  )

/** A download: the browser follows it with the session cookie. */
export const passExportUrl = (code: string) => `${API_URL}${pass(code)}/export`

export const syncPassSeason = (code: string) =>
  request<{ season: string; duels: number; tournaments: number; skipped?: string }>(`${pass(code)}/sync`, json('POST'))

export const getPassProgress = (code: string, userId: string, signal?: AbortSignal) =>
  request<PassProgress>(`${pass(code)}/users/${seg(userId)}`, { signal })

/** Never below 0. Logged. */
export const adjustPassXp = (code: string, userId: string, amount: number, note?: string) =>
  request<{ xp: number }>(`${pass(code)}/users/${seg(userId)}/xp`, json('POST', { amount, ...(note ? { note } : {}) }))

/** The site's premium only; the game's pass isn't touched. */
export const setPassPremium = (code: string, userId: string, premium: boolean) =>
  request<{ webPremium: boolean }>(`${pass(code)}/users/${seg(userId)}/premium`, json('PUT', { premium }))

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
