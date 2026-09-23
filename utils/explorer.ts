/**
 * Duelist analytics explorer (ANALYTICS_API.md §6): a GA4-style pivot cut on the client from
 * `GET /analytics/players/:id/seasons/:season`, one response per compared season.
 *
 * The catalog (`GET /analytics/variables`) says which metric splits by which dimension; this file
 * knows how to compute each id it lists. An id the client can't compute yet is left out of the
 * builder instead of guessed. Rates always sum the parts, then divide.
 */
import { archetypeName, duelistName, type Duelist, type PlayerSeason } from './analytics'

/* ---------------------------------------------------------------- *
 * API shapes (§6.1, §6.2)
 * ---------------------------------------------------------------- */

export type Technique = 'table' | 'heatmap' | 'bars' | 'line'
/** `days` and `groups` only exist in the global catalog (§7), `rating` only in the duelist's. */
export type Source = 'games' | 'cards' | 'handTraps' | 'rating' | 'days' | 'groups'
/** How a source reads in a sentence. */
export const SOURCE_NAME: Record<Source, string> = { games: 'games', cards: 'cards', handTraps: 'hand traps', rating: 'daily rating', days: 'days', groups: 'engines & techs' }
export type FilterValue = string | number | null

export type Dimension = { id: string; label: string; values: string; description: string }
/** `last` = the value of the latest point in the cut, never summed or averaged. */
export type Metric = { id: string; label: string; source: Source; format: 'count' | 'rate' | 'average' | 'last'; splitBy: string[]; from: string; description: string }
export type Limits = { segments: number; rows: number; columns: number; values: number; filters: number; explorations: number; name: number; rowLimit: number }

export type Variables = {
  version: number
  techniques: Technique[]
  limits: Limits
  /** Duelist catalog only. */
  currentSegments?: string[]
  dimensions: Dimension[]
  metrics: Metric[]
}

export type ExplorationConfig = {
  v: 1
  technique: Technique
  /** Season codes, or `current:tcg` / `current:genesys` (the open season when read). 1–4. */
  segments: string[]
  rows: string[]
  columns: string | null
  values: string[]
  filters: { dimension: string; value: FilterValue }[]
  /** `value` indexes `values`. `null` = the first row's natural order, else the first metric, descending. */
  sort: { value: number; direction: 'asc' | 'desc' } | null
  limit: number
  runningTotal: boolean
}

/** `private`: the owner only. `link`: anyone with the share URL. `public`: listed on the profile and the public feed. */
export type Visibility = 'private' | 'link' | 'public'

export type Exploration = {
  id: string
  /** The profile it belongs to. */
  ownerId: string
  /** Who created it: the owner, or an analyst writing on their profile. */
  author: Duelist
  /** The owner, only when `author` is someone else (an analyst). */
  coAuthor: Duelist | null
  name: string
  visibility: Visibility
  /** Builds the share URL (`/analytics/e/:token`). `null` on a `link` row the viewer doesn't own (analysts always get it). */
  shareToken: string | null
  /** Tab order. */
  position: number
  config: ExplorationConfig
  createdAt: string
  updatedAt: string
}

/* ---------------------------------------------------------------- *
 * Facts: one row per game, per card used in a game, per hand-trap activation
 * ---------------------------------------------------------------- */

type SeasonGame = PlayerSeason['games'][number]

/**
 * `game: null` marks a row that only exists in the season aggregates (`cardUsage`, `responses`):
 * it names a group for deck inclusion and responses, and is never counted.
 */
type Fact = {
  game: SeasonGame | null
  /** 1-based day of the season. */
  day: number | null
  archetype?: string | null
  cardId?: number
  uses?: number
  activated?: boolean
  handTrap?: number
  by?: 'player' | 'opponent'
  /** A rating row (`eloHistory[]`): its `day` is the ready-made `seasonDay`. */
  elo?: number
}

/** A season the Segments panel offers. `code` resolves `current:*`; `null` when that ladder has no open season. */
export type SegmentOption = { id: string; label: string; sub: string; code: string | null }

/** One compared season, ready to cut. */
export type Segment = {
  /** As saved: a code or `current:*`. */
  id: string
  label: string
  season: PlayerSeason
  days: number
  games: Fact[]
  cards: Fact[]
  handTraps: Fact[]
  rating: Fact[]
  /** Group names for the aggregate-only metrics. */
  aggregate: { cards: Fact[]; handTraps: Fact[] }
}

const DAY = 86_400_000

/** `TCG · 09.2026`, or `Current TCG · 09.2026` for a segment that follows the open season. */
export const segmentLabel = (id: string, season: PlayerSeason['season']) =>
  `${id.startsWith('current:') ? 'Current ' : ''}${season.ladder === 'genesys' ? 'Genesys' : 'TCG'} · ${season.label}`

export const buildSegment = (id: string, season: PlayerSeason): Segment => {
  const start = Date.parse(season.season.startsAt)
  const games: Fact[] = season.games.map((game) => ({
    game,
    archetype: game.archetype,
    day: game.start ? Math.floor((Date.parse(game.start) - start) / DAY) + 1 : null,
  }))
  const rating: Fact[] = (season.eloHistory ?? []).map((p) => ({ game: null, day: p.seasonDay, elo: p.elo }))
  const lastDay = season.season.endsAt ? Math.floor((Date.parse(season.season.endsAt) - start) / DAY) + 1 : 0
  return {
    id, season,
    label: segmentLabel(id, season.season),
    days: Math.max(1, lastDay, ...[...games, ...rating].map((f) => f.day ?? 1)),
    games,
    rating,
    cards: games.flatMap((f) =>
      (f.game!.cards?.used ?? []).map((u) => ({ ...f, cardId: u.cardId, uses: u.uses, activated: f.game!.cards!.activated.includes(u.cardId) })),
    ),
    handTraps: games.flatMap((f) => [
      ...(f.game!.handTraps?.player ?? []).map((handTrap) => ({ ...f, handTrap, by: 'player' as const })),
      ...(f.game!.handTraps?.opponent ?? []).map((handTrap) => ({ ...f, handTrap, by: 'opponent' as const })),
    ]),
    aggregate: {
      cards: season.cardUsage.flatMap((c) => [
        { game: null, day: null, cardId: c.cardId },
        ...c.byArchetype.map((a) => ({ game: null, day: null, cardId: c.cardId, archetype: a.archetype })),
      ]),
      handTraps: season.responses.flatMap((r) =>
        (['player', 'opponent'] as const)
          .filter((by) => (by === 'player' ? r.byPlayer : r.byOpponent).activations)
          .map((by) => ({ game: null, day: null, handTrap: r.cardId, by })),
      ),
    },
  }
}

/** Names the season responses carry, merged over every compared season. */
export type Names = { opponents: Record<string, Duelist>; cards: Map<number, string | null> }

export const namesOf = (segments: Segment[]): Names => ({
  opponents: Object.assign({}, ...segments.map((s) => s.season.opponents)),
  cards: new Map(segments.flatMap((s) => [...s.season.cardUsage, ...s.season.responses].map((c) => [c.cardId, c.name] as const))),
})

/* ---------------------------------------------------------------- *
 * Dimensions: the value a fact takes, its label, its order
 * ---------------------------------------------------------------- */

type DimImpl = {
  /** `undefined`: the dimension doesn't apply to this fact. */
  value: (f: Fact) => FilterValue | undefined
  label: (v: FilterValue, names: Names) => string
  /** Rows keep this order instead of sorting by metric. */
  natural?: 'asc' | 'desc'
  key?: (f: Fact) => number | string
}

const RESULT_LABEL: Record<string, string> = { win: 'Win', loss: 'Loss', draw: 'Draw', none: 'No result' }
const RESULT_ORDER: Record<string, number> = { win: 0, loss: 1, draw: 2, none: 3 }
const pad2 = (n: number) => String(n).padStart(2, '0')
const onGame = <T,>(f: Fact, get: (g: SeasonGame) => T) => (f.game ? get(f.game) : undefined)

const DIM_IMPL: Record<string, DimImpl> = {
  archetype: { value: (f) => f.archetype, label: (v) => archetypeName(v as string | null) },
  opponentArchetype: { value: (f) => onGame(f, (g) => g.opponentArchetype), label: (v) => archetypeName(v as string | null) },
  opponent: { value: (f) => onGame(f, (g) => g.opponentId), label: (v, n) => (v === null ? 'Unknown duelist' : duelistName(n.opponents[v as string])) },
  turnOrder: {
    value: (f) => onGame(f, (g) => (g.wentFirst === null ? null : g.wentFirst ? 'first' : 'second')),
    label: (v) => (v === 'first' ? 'Going first' : v === 'second' ? 'Going second' : 'Unknown'),
    natural: 'asc',
    key: (f) => (f.game?.wentFirst ? 0 : f.game?.wentFirst === false ? 1 : 2),
  },
  gameNumber: { value: (f) => onGame(f, (g) => g.gameNumber), label: (v) => `Game ${v}`, natural: 'asc' },
  result: {
    value: (f) => onGame(f, (g) => g.result ?? 'none'),
    label: (v) => RESULT_LABEL[v as string] ?? String(v),
    natural: 'asc',
    key: (f) => RESULT_ORDER[f.game?.result ?? 'none'] ?? 3,
  },
  match: { value: (f) => onGame(f, (g) => g.matchId), label: (v) => `#${v}`, natural: 'desc', key: (f) => f.game?.start ?? '' },
  seasonDay: { value: (f) => (f.game || f.elo !== undefined ? f.day : undefined), label: (v) => (v === null ? 'No date' : `Day ${pad2(v as number)}`), natural: 'asc' },
  card: { value: (f) => f.cardId, label: (v, n) => n.cards.get(v as number) ?? `#${v}` },
  handTrap: { value: (f) => f.handTrap, label: (v, n) => n.cards.get(v as number) ?? `#${v}` },
  activatedBy: { value: (f) => f.by, label: (v) => (v === 'player' ? 'You' : 'Opponents'), natural: 'asc', key: (f) => (f.by === 'player' ? 0 : 1) },
}

/** Dimensions a `games[]` row carries: they also narrow the games a per-game rate divides by. */
const GAME_DIMS = new Set(['archetype', 'opponentArchetype', 'opponent', 'turnOrder', 'gameNumber', 'result', 'match', 'seasonDay'])

const dimValue = (d: string, f: Fact) => DIM_IMPL[d]?.value(f)
const dimKey = (d: string, f: Fact) => DIM_IMPL[d]?.key?.(f) ?? dimValue(d, f) ?? ''
export const dimNatural = (d: string) => DIM_IMPL[d]?.natural
export const dimLabel = (d: string, v: FilterValue, names: Names) => DIM_IMPL[d]?.label(v, names) ?? String(v)

/* ---------------------------------------------------------------- *
 * Metrics
 * ---------------------------------------------------------------- */

/** Dimension id → required value. */
type Cut = Record<string, FilterValue>
type Ctx = {
  /** Source rows in the cut (real ones only). */
  facts: Fact[]
  /** Games in the cut: the denominator of per-game rates. */
  games: Fact[]
  cut: Cut
  seg: Segment
}

const ratio = (a: number, b: number) => (b ? a / b : null)
const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((n, r) => n + f(r), 0)
const count = <T,>(rows: T[], f: (r: T) => boolean) => rows.filter(f).length
const distinctGames = (rows: Fact[]) => new Set(rows.map((f) => `${f.game!.matchId}-${f.game!.gameNumber}`)).size
const mean = (values: (number | null | undefined)[]) => {
  const known = values.filter((v): v is number => typeof v === 'number')
  return known.length ? sum(known, (v) => v) / known.length : null
}
/** Wins ÷ games with a result. A draw is a non-win. */
const winRate = (rows: Fact[]) => ratio(count(rows, (f) => f.game!.result === 'win'), count(rows, (f) => f.game!.result !== null))
const onePerGame = (rows: Fact[]) => [...new Map(rows.map((f) => [`${f.game!.matchId}-${f.game!.gameNumber}`, f])).values()]

/** `cardUsage` of the card in the cut, narrowed to its archetype when the cut fixes one. */
const inclusion = ({ cut, seg }: Ctx) => {
  if (!('card' in cut)) return null
  const card = seg.season.cardUsage.find((c) => c.cardId === cut.card)
  if (!card) return { games: 0, rate: 0 }
  if (!('archetype' in cut)) return card.deckInclusion
  return card.byArchetype.find((a) => a.archetype === cut.archetype)?.deckInclusion ?? { games: 0, rate: 0 }
}

/** `responses` summed over the hand traps and sides in the cut. */
const responses = ({ cut, seg }: Ctx) => {
  const sides = 'activatedBy' in cut ? [cut.activatedBy as 'player' | 'opponent'] : (['player', 'opponent'] as const)
  const splits = seg.season.responses
    .filter((r) => !('handTrap' in cut) || r.cardId === cut.handTrap)
    .flatMap((r) => sides.map((by) => (by === 'player' ? r.byPlayer : r.byOpponent)))
  return {
    activations: sum(splits, (s) => s.activations),
    responded: sum(splits, (s) => s.responded),
    called: sum(splits, (s) => s.calledByTheGrave),
    crossout: sum(splits, (s) => s.crossoutDesignator),
  }
}

const COMPUTE: Record<string, (ctx: Ctx) => number | null> = {
  games: ({ facts }) => facts.length,
  matches: ({ facts }) => new Set(facts.map((f) => f.game!.matchId)).size,
  wins: ({ facts }) => count(facts, (f) => f.game!.result === 'win'),
  losses: ({ facts }) => count(facts, (f) => f.game!.result === 'loss'),
  draws: ({ facts }) => count(facts, (f) => f.game!.result === 'draw'),
  winRate: ({ facts }) => winRate(facts),
  averageTurns: ({ facts }) => mean(facts.map((f) => f.game!.turns)),
  averageActions: ({ facts }) => mean(facts.map((f) => f.game!.actions)),
  comboLength: ({ facts }) => ratio(sum(facts, (f) => f.game!.combo?.actions ?? 0), sum(facts, (f) => f.game!.combo?.turns ?? 0)),
  deckCoverageMain: ({ facts }) => mean(facts.map((f) => f.game!.deckCoverage?.main)),
  deckCoverageExtra: ({ facts }) => mean(facts.map((f) => f.game!.deckCoverage?.extra)),
  turn1SpecialSummons: ({ facts }) => mean(facts.map((f) => f.game!.turn1SpecialSummons)),
  longestChain: ({ facts }) => mean(facts.map((f) => f.game!.longestChain)),

  usage: ({ facts, games }) => ratio(distinctGames(facts), games.length),
  usageGames: ({ facts }) => distinctGames(facts),
  totalUses: ({ facts }) => sum(facts, (f) => f.uses ?? 0),
  activatedGames: ({ facts }) => distinctGames(facts.filter((f) => f.activated)),
  winRateWhenActivated: ({ facts }) => winRate(onePerGame(facts.filter((f) => f.activated))),
  deckInclusion: (ctx) => inclusion(ctx)?.rate ?? null,
  inclusionGames: (ctx) => inclusion(ctx)?.games ?? null,

  activations: ({ facts }) => facts.length,
  gamesWithActivation: ({ facts }) => distinctGames(facts),
  activationsPerGame: ({ facts, games }) => ratio(facts.length, games.length),
  responded: (ctx) => responses(ctx).responded,
  respondedRate: (ctx) => {
    const r = responses(ctx)
    return ratio(r.responded, r.activations)
  },
  calledByTheGrave: (ctx) => responses(ctx).called,
  calledByTheGraveRate: (ctx) => {
    const r = responses(ctx)
    return ratio(r.called, r.responded)
  },
  crossoutDesignator: (ctx) => responses(ctx).crossout,
  crossoutDesignatorRate: (ctx) => {
    const r = responses(ctx)
    return ratio(r.crossout, r.responded)
  },

  /** The latest recorded day in the cut. */
  elo: ({ facts }) => facts.reduce<Fact | null>((last, f) => (!last || (f.day ?? 0) > (last.day ?? 0) ? f : last), null)?.elo ?? null,
}

/** Metrics read from the season aggregates: they name their own groups and never count facts. */
const AGGREGATE = new Set(['deckInclusion', 'inclusionGames', 'responded', 'respondedRate', 'calledByTheGrave', 'calledByTheGraveRate', 'crossoutDesignator', 'crossoutDesignatorRate'])
/** Win/loss rates: 50% is the line that matters. */
export const WIN_LOSS = new Set(['winRate', 'winRateWhenActivated', 'dailyWinRate', 'winRateWithGroup'])
/** Read from the per-game detail (§3.4): undercounts while `gamesWithoutDetail` > 0. */
const NEEDS_DETAIL = (m: Metric) => /combo|deckCoverage|turn1|longestChain|cards\.|handTraps/.test(m.from)

/* ---------------------------------------------------------------- *
 * The catalog, narrowed to what this client computes
 * ---------------------------------------------------------------- */

export type Catalog = {
  limits: Limits
  techniques: Technique[]
  dimensions: Map<string, Dimension>
  metrics: Map<string, Metric>
}

export const catalogOf = (vars: Variables): Catalog => ({
  limits: vars.limits,
  techniques: vars.techniques,
  dimensions: new Map(vars.dimensions.filter((d) => d.id in DIM_IMPL).map((d) => [d.id, d])),
  metrics: new Map(vars.metrics.filter((m) => m.id in COMPUTE).map((m) => [m.id, { ...m, splitBy: m.splitBy.filter((d) => d in DIM_IMPL) }])),
})

export const fmt = (v: number | null | undefined, format: Metric['format']) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  if (format === 'rate') return `${(v * 100).toFixed(1)}%`
  if (format === 'average') return v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)
  if (format === 'last') return Math.round(v).toLocaleString('en-US')
  return Math.round(v).toLocaleString('en-US')
}

/* ---------------------------------------------------------------- *
 * Compatibility (§6.1): the builder greys out, the backend refuses on save
 * ---------------------------------------------------------------- */

const usedDims = (cfg: ExplorationConfig) => [...cfg.rows, ...(cfg.columns ? [cfg.columns] : []), ...cfg.filters.map((f) => f.dimension)]
const valueMetrics = (cat: Catalog, cfg: ExplorationConfig) => cfg.values.flatMap((id) => cat.metrics.get(id) ?? [])

export const sourceOf = (cat: Catalog, cfg: ExplorationConfig): Source => {
  const first = valueMetrics(cat, cfg)[0]
  if (first) return first.source
  const dims = usedDims(cfg)
  return sourcesOf(cat).find((s) => dims.every((d) => [...cat.metrics.values()].some((m) => m.source === s && m.splitBy.includes(d)))) ?? 'games'
}

/** The catalog's sources, in the order its metrics list them. */
export const sourcesOf = (cat: Catalog) => [...new Set([...cat.metrics.values()].map((m) => m.source))]

/** Why a metric can't join this exploration, or `null` when it can. */
export const metricReason = (cat: Catalog, id: string, cfg: ExplorationConfig) => {
  const M = cat.metrics.get(id)
  if (!M) return 'Unknown metric'
  const other = valueMetrics(cat, cfg).find((m) => m.source !== M.source)
  if (other && !cfg.values.includes(id)) return `From ${SOURCE_NAME[M.source]}, not ${SOURCE_NAME[other.source]}`
  const blocked = usedDims(cfg).find((d) => !M.splitBy.includes(d))
  return blocked ? `Not split by ${cat.dimensions.get(blocked)?.label.toLowerCase() ?? blocked}` : null
}

/** Why a dimension can't split this exploration, or `null` when it can. */
export const dimReason = (cat: Catalog, id: string, cfg: ExplorationConfig) => {
  const blocking = valueMetrics(cat, cfg).find((m) => !m.splitBy.includes(id))
  if (blocking) return `${blocking.label} is not split by it`
  if (cfg.values.length) return null
  const dims = [...usedDims(cfg), id]
  const fits = [...cat.metrics.values()].some((m) => dims.every((d) => m.splitBy.includes(d)))
  return fits ? null : 'No metric splits by all of these'
}

/* ---------------------------------------------------------------- *
 * Pivot
 * ---------------------------------------------------------------- */

const matches = (f: Fact, cut: Cut) => Object.entries(cut).every(([d, v]) => dimValue(d, f) === v)
const gameCut = (cut: Cut) => Object.fromEntries(Object.entries(cut).filter(([d]) => GAME_DIMS.has(d)))
const factsOf = (seg: Segment, source: Source): Fact[] => ({ games: seg.games, cards: seg.cards, handTraps: seg.handTraps, rating: seg.rating } as Partial<Record<Source, Fact[]>>)[source] ?? []
/** What a row counts: games, or distinct games for card and hand-trap rows, or recorded days. */
const sampleOf = (source: Source, rows: Fact[]) => (source === 'cards' || source === 'handTraps' ? distinctGames(rows) : rows.length)
const UNIT: Partial<Record<Source, string>> = { games: 'games', cards: 'games', handTraps: 'activations', rating: 'days' }

const measure = (cat: Catalog, id: string, seg: Segment, source: Source, cut: Cut, rows?: Fact[], extra?: (f: Fact) => boolean) => {
  const keep = (f: Fact) => matches(f, cut) && (!extra || extra(f))
  const gc = gameCut(cut)
  const games = seg.games.filter((f) => matches(f, gc) && (!extra || extra(f)))
  return COMPUTE[id]!({ facts: rows ?? factsOf(seg, source).filter(keep), games, cut, seg })
}

export type Cell = { value: number | null; n: number }
export type GroupSegment = { vals: (number | null)[]; n: number; cells: Cell[] }
export type Group = { key: string; labels: string[]; values: FilterValue[]; matchId: string | null; sub: string; seg: GroupSegment[] }

/** What the output draws. Both engines (this file and utils/global-explorer.ts) produce it. */
export type PivotResult = {
  source: Source
  values: string[]
  rowDims: string[]
  colDim: string | null
  segs: { id: string; label: string; color: string }[]
  groups: Group[]
  totalGroups: number
  colList: { v: FilterValue; sk: number | string; n: number; label: string }[]
  hiddenCols: number
  /** One per segment. `null` when a total means nothing for this source. */
  totals: { count: number; vals: (number | null)[] }[] | null
  /** What `count` and `n` count: games, deck-games, activations… */
  unit: string
  /** A caveat for the source bar, or `''`. */
  note: string
}

export type LineData = { maxDay: number; series: { label: string; color: string; points: { day: number; value: number | null }[] }[] }

/** The row's natural order when nothing is sorted and the first row has one, else by the sorted metric of the first segment. */
export const sortGroups = <G extends { sk: (number | string)[]; seg: GroupSegment[] }>(order: G[], rowDims: string[], cfg: ExplorationConfig) => {
  const natural = rowDims[0] ? dimNatural(rowDims[0]) : undefined
  if (!cfg.sort && natural) {
    const dir = natural === 'desc' ? -1 : 1
    const k = (g: G) => g.sk[0] ?? ''
    order.sort((a, b) => (k(a) < k(b) ? -dir : k(a) > k(b) ? dir : 0))
  } else {
    const i = cfg.sort?.value ?? 0
    const dir = cfg.sort?.direction === 'asc' ? 1 : -1
    const lead = (g: G) => g.seg[0]!
    order.sort((a, b) => ((lead(a).vals[i] ?? -Infinity) - (lead(b).vals[i] ?? -Infinity)) * dir || lead(b).n - lead(a).n)
  }
}

export const run = (cat: Catalog, segs: Segment[], cfg: ExplorationConfig, names: Names): PivotResult => {
  const values = cfg.values.filter((m) => cat.metrics.has(m))
  const source = sourceOf(cat, cfg)
  const rowDims = cfg.rows.filter((d) => d in DIM_IMPL)
  const colDim = cfg.columns && cfg.columns in DIM_IMPL ? cfg.columns : null
  const filterCut: Cut = Object.fromEntries(cfg.filters.filter((f) => f.dimension in DIM_IMPL).map((f) => [f.dimension, f.value]))
  const aggregate = values.some((m) => AGGREGATE.has(m))
  const sample = (rows: Fact[]) => sampleOf(source, rows)

  type Building = { key: string; values: FilterValue[]; sk: (number | string)[]; matchId: string | null; sub: string; rows: Fact[][]; cols: Map<string, Fact[]>[] }
  const groups = new Map<string, Building>()
  const colVals = new Map<string, { v: FilterValue; sk: number | string; n: number }>()

  segs.forEach((seg, si) => {
    const rows = factsOf(seg, source).filter((f) => matches(f, filterCut))
    const named = aggregate ? (source === 'cards' ? seg.aggregate.cards : seg.aggregate.handTraps).filter((f) => rowDims.every((d) => dimValue(d, f) !== undefined) && matches(f, filterCut)) : []
    for (const f of [...rows, ...named]) {
      const vals = rowDims.map((d) => dimValue(d, f) ?? null)
      const key = JSON.stringify(vals)
      let g = groups.get(key)
      if (!g) {
        const isMatch = rowDims[0] === 'match' && f.game
        g = {
          key, values: vals, sk: rowDims.map((d) => dimKey(d, f)),
          matchId: isMatch ? f.game!.matchId : null,
          sub: isMatch ? `${f.game!.start ? new Date(f.game!.start).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : '—'} · vs ${dimLabel('opponent', f.game!.opponentId, names)}` : '',
          rows: segs.map(() => []), cols: segs.map(() => new Map()),
        }
        groups.set(key, g)
      }
      if (!f.game) continue
      g.rows[si]!.push(f)
      if (colDim) {
        const cv = dimValue(colDim, f) ?? null
        const ck = JSON.stringify(cv)
        const c = colVals.get(ck) ?? { v: cv, sk: dimKey(colDim, f), n: 0 }
        c.n++
        colVals.set(ck, c)
        g.cols[si]!.set(ck, [...(g.cols[si]!.get(ck) ?? []), f])
      }
    }
  })

  const colAll = [...colVals.values()].sort(colDim && dimNatural(colDim) ? (a, b) => (a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0) : (a, b) => b.n - a.n)
  const colList = colAll.slice(0, 8)

  const order = [...groups.values()].map((g) => {
    const cut: Cut = { ...filterCut, ...Object.fromEntries(rowDims.map((d, i) => [d, g.values[i] ?? null])) }
    return {
      key: g.key, values: g.values, sk: g.sk, matchId: g.matchId, sub: g.sub,
      labels: rowDims.length ? rowDims.map((d, i) => dimLabel(d, g.values[i] ?? null, names)) : [`All ${source === 'handTraps' ? 'hand traps' : source === 'rating' ? 'days' : source}`],
      seg: segs.map((seg, si) => {
        const rows = g.rows[si]!
        return {
          vals: values.map((m) => measure(cat, m, seg, source, cut, AGGREGATE.has(m) ? [] : rows)),
          n: sample(rows),
          cells: colDim
            ? colList.map((c) => {
              const ck = JSON.stringify(c.v)
              const cellRows = g.cols[si]!.get(ck) ?? []
              return { value: values[0] ? measure(cat, values[0], seg, source, { ...cut, [colDim]: c.v }, cellRows) : null, n: sample(cellRows) }
            })
            : [],
        }
      }),
    }
  })
    // A name from the aggregates with nothing behind it in any season is noise.
    .filter((g) => g.seg.some((s) => s.n || s.vals.some((v) => v)))

  sortGroups(order, rowDims, cfg)
  /** Games whose per-game detail is missing, when a value needs it. */
  const withoutDetail = values.some((m) => NEEDS_DETAIL(cat.metrics.get(m)!)) ? sum(segs, (s) => s.season.gamesWithoutDetail ?? 0) : 0

  return {
    source, values, rowDims, colDim,
    segs: segs.map((s, i) => ({ id: s.id, label: s.label, color: segColor(i) })),
    groups: order.slice(0, cfg.limit || 12) as Group[],
    totalGroups: order.length,
    colList: colList.map((c) => ({ ...c, label: dimLabel(colDim!, c.v, names) })),
    hiddenCols: colAll.length - colList.length,
    totals: source === 'cards' ? null : segs.map((seg) => ({
      count: factsOf(seg, source).filter((f) => matches(f, filterCut)).length,
      vals: values.map((m) => measure(cat, m, seg, source, filterCut)),
    })),
    unit: UNIT[source] ?? source,
    note: withoutDetail ? `${withoutDetail} older games have no per-game detail and are left out` : '',
  }
}

/** One series per season, or per column value when a single season is split by Columns. */
export const lineSeries = (cat: Catalog, segs: Segment[], res: PivotResult, cfg: ExplorationConfig): LineData => {
  const metric = res.values[0]!
  const filterCut: Cut = Object.fromEntries(cfg.filters.map((f) => [f.dimension, f.value]))
  const colDim = res.colDim
  const series =
    segs.length === 1 && colDim
      ? res.colList.slice(0, 4).map((c, i) => ({ label: c.label, color: segColor(i), seg: segs[0]!, cut: { ...filterCut, [colDim]: c.v } }))
      : segs.map((s, i) => ({ label: s.label, color: segColor(i), seg: s, cut: filterCut }))
  return {
    maxDay: Math.max(1, ...series.map((s) => s.seg.days)),
    series: series.map((se) => ({
      label: se.label,
      color: se.color,
      points: Array.from({ length: se.seg.days }, (_, i) => {
        const day = i + 1
        const inDay = (f: Fact) => f.day !== null && (cfg.runningTotal ? f.day <= day : f.day === day)
        const any = factsOf(se.seg, res.source === 'rating' ? 'rating' : 'games').some((f) => inDay(f) && matches(f, gameCut(se.cut)))
        return { day, value: any ? measure(cat, metric, se.seg, res.source, se.cut, undefined, inDay) : null }
      }),
    })),
  }
}

/** Why a technique can't draw this exploration, or `null` when it can. */
export const blocker = (cfg: ExplorationConfig, res: PivotResult) =>
  configProblem(cfg) ?? (res.totalGroups === 0 ? { title: 'No games match', body: 'Nothing in these seasons passes the filters. Remove a filter or add a season.' } : null)

/** The §6.1 rules the backend refuses on save, worded for the owner. `null` when it can be saved. */
export const configProblem = (cfg: ExplorationConfig) => {
  if (!cfg.values.length) return { title: 'Add a metric', body: 'Drop a metric into Values. Dimensions split it; metrics are what gets counted.' }
  if (cfg.technique === 'heatmap' && !cfg.columns) return { title: 'Heatmap needs columns', body: 'Drop a dimension into Columns — Turn order or Opponent archetype work well — to get a grid.' }
  if (cfg.technique === 'heatmap' && !cfg.rows.length) return { title: 'Heatmap needs rows', body: 'Drop a dimension into Rows as well.' }
  if (cfg.technique === 'bars' && !cfg.rows.length) return { title: 'Bars need a row', body: 'Drop a dimension into Rows. Each value becomes a bar.' }
  if (cfg.technique === 'line' && cfg.rows[0] !== 'seasonDay') return { title: 'Line needs Season day', body: 'Put Season day first in Rows. The line runs along the season, one point per day.' }
  return null
}

/** A one-click way out of a blocker, when there is an obvious one. */
export const fixFor = (cat: Catalog, cfg: ExplorationConfig): { label: string; apply: (t: ExplorationConfig) => void } | null => {
  const first = cfg.values[0] ? cat.metrics.get(cfg.values[0]) : undefined
  if (cfg.technique === 'line' && cfg.rows[0] !== 'seasonDay' && first?.splitBy.includes('seasonDay'))
    return { label: 'Put Season day in Rows', apply: (t) => Object.assign(t, { rows: ['seasonDay'], columns: null, sort: null }) }
  if (cfg.technique === 'heatmap' && !cfg.columns && first?.splitBy.includes('turnOrder')) return { label: 'Add Turn order to Columns', apply: (t) => (t.columns = 'turnOrder') }
  if (!first && cat.metrics.has('winRate')) return { label: 'Add Win rate', apply: (t) => t.values.push('winRate') }
  return null
}

/* ---------------------------------------------------------------- *
 * Builder rules
 * ---------------------------------------------------------------- */

export type Zone = 'segments' | 'rows' | 'columns' | 'values' | 'filters'
const ZONE_KIND: Record<Zone, Payload['kind']> = { segments: 'seg', rows: 'dim', columns: 'dim', filters: 'dim', values: 'metric' }

/** What is being dragged: a variable, or a chip already in a zone (`from`, `i`). */
export type Payload = { kind: 'seg' | 'dim' | 'metric'; id: string; from?: Zone; i?: number }

export const capOf = (cat: Catalog, zone: Zone) => cat.limits[zone]

/** Every value a dimension takes in these seasons, in its natural order, labelled. */
export const valuesOf = (cat: Catalog, segs: Segment[], dim: string, source: Source, names: Names) => {
  const seen = new Map<string, { v: FilterValue; k: number | string }>()
  for (const seg of segs) {
    for (const f of [...factsOf(seg, source), ...(source === 'games' ? [] : source === 'cards' ? seg.aggregate.cards : seg.aggregate.handTraps)]) {
      const v = dimValue(dim, f)
      if (v !== undefined) seen.set(JSON.stringify(v), { v, k: dimKey(dim, f) })
    }
  }
  const list = [...seen.values()].sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
  if (dim === 'match') list.reverse()
  return list.map(({ v }) => ({ v, label: dimLabel(dim, v, names) }))
}

export const accepts = (cat: Catalog, zone: Zone, p: Payload, cfg: ExplorationConfig) => {
  if (ZONE_KIND[zone] !== p.kind || p.from === zone) return false
  if (p.kind === 'seg') return cfg.segments.length < cat.limits.segments && !cfg.segments.includes(p.id)
  if (p.kind === 'metric') return cfg.values.length < cat.limits.values && !cfg.values.includes(p.id) && !metricReason(cat, p.id, cfg)
  if (!p.from && dimReason(cat, p.id, cfg)) return false
  if (zone === 'rows') return cfg.rows.length < cat.limits.rows && !cfg.rows.includes(p.id) && cfg.columns !== p.id
  if (zone === 'columns') return cfg.columns !== p.id && !cfg.rows.includes(p.id)
  return cfg.filters.length < cat.limits.filters && !cfg.filters.some((f) => f.dimension === p.id)
}

export const removeFrom = (t: ExplorationConfig, zone: Zone, i: number) => {
  if (zone === 'columns') t.columns = null
  else t[zone].splice(i, 1)
  t.sort = null
}

/** A drop, or a move between zones. The new config, or `null` when refused. `firstValue` seeds a new filter. */
export const drop = <T extends ExplorationConfig>(cat: Catalog, cfg: T, zone: Zone, p: Payload, firstValue: (dim: string, t: T) => FilterValue | undefined): T | null => {
  const t = structuredClone(cfg)
  if (p.from) {
    if (p.from === zone) return null
    removeFrom(t, p.from, p.i ?? 0)
  }
  if (!accepts(cat, zone, p, t)) return null
  if (zone === 'segments') t.segments.push(p.id)
  else if (zone === 'values') t.values.push(p.id)
  else if (zone === 'columns') t.columns = p.id
  else if (zone === 'rows') t.rows.push(p.id)
  else {
    const value = firstValue(p.id, t)
    if (value === undefined) return null
    t.filters.push({ dimension: p.id, value })
  }
  t.sort = null
  return t
}

/** The "+" on a variable: a season toggles, a metric fills Values, a dimension fills Rows, then Columns, then Filters. */
export const quickAdd = <T extends ExplorationConfig>(cat: Catalog, cfg: T, p: Payload, firstValue: (dim: string, t: T) => FilterValue | undefined): T | null => {
  if (p.kind === 'seg' && cfg.segments.includes(p.id)) {
    if (cfg.segments.length === 1) return null
    const t = structuredClone(cfg)
    t.segments.splice(t.segments.indexOf(p.id), 1)
    return t
  }
  const zones: Zone[] = p.kind === 'seg' ? ['segments'] : p.kind === 'metric' ? ['values'] : cfg.columns ? ['rows', 'filters'] : ['rows', 'columns', 'filters']
  for (const zone of zones) {
    const t = drop(cat, cfg, zone, p, firstValue)
    if (t) return t
  }
  return null
}

/** Which zone each variable sits in. */
export const inUse = (cfg: ExplorationConfig) => {
  const u: Record<string, Zone> = {}
  cfg.rows.forEach((d) => (u[d] = 'rows'))
  if (cfg.columns) u[cfg.columns] = 'columns'
  cfg.filters.forEach((f) => (u[f.dimension] = 'filters'))
  cfg.values.forEach((m) => (u[m] = 'values'))
  cfg.segments.forEach((s) => (u[s] = 'segments'))
  return u
}

export const summary = (cat: Catalog, cfg: ExplorationConfig, segLabel: (id: string) => string, names: Names) =>
  [
    cfg.segments.map(segLabel).join(' vs '),
    cfg.rows.length ? `rows: ${cfg.rows.map((d) => cat.dimensions.get(d)?.label ?? d).join(', ')}` : '',
    cfg.columns ? `columns: ${cat.dimensions.get(cfg.columns)?.label ?? cfg.columns}` : '',
    cfg.values.map((m) => cat.metrics.get(m)?.label ?? m).join(', '),
    ...cfg.filters.map((f) => `${cat.dimensions.get(f.dimension)?.label ?? f.dimension} = ${dimLabel(f.dimension, f.value, names)}`),
  ]
    .filter(Boolean)
    .join(' · ')

const SEG_COLORS = ['var(--color-gold)', 'var(--color-cyan)', 'var(--color-indigo-lift)', 'var(--color-ink-dim)']
/** One colour per compared season, in the order they were added. */
export const segColor = (i: number) => SEG_COLORS[i] ?? 'var(--color-ink-dim)'

/* ---------------------------------------------------------------- *
 * Header numbers
 * ---------------------------------------------------------------- */

export const kpis = (seg: Segment) => {
  const g = seg.games
  const first = g.filter((f) => f.game!.wentFirst === true)
  const second = g.filter((f) => f.game!.wentFirst === false)
  const top = seg.season.archetypeDistribution[0]
  const wr = winRate(g)
  const r = seg.season.record
  return [
    { label: 'Games', value: fmt(g.length, 'count'), sub: `${fmt(seg.season.matchCount, 'count')} matches` },
    { label: 'Win rate', value: fmt(wr, 'rate'), sub: `${r.wins}–${r.losses}–${r.draws}`, tone: wr === null ? undefined : wr >= 0.5 ? 'text-win' : 'text-loss' },
    { label: 'Going first', value: fmt(winRate(first), 'rate'), sub: `${first.length} games` },
    { label: 'Going second', value: fmt(winRate(second), 'rate'), sub: `${second.length} games` },
    {
      label: 'Main archetype',
      value: top ? archetypeName(top.archetype) : '—',
      sub: seg.season.archetypeDistribution.length > 1 ? `${seg.season.archetypeDistribution.length} archetypes` : top ? 'every game' : '',
      tone: 'text-gold',
    },
  ]
}
