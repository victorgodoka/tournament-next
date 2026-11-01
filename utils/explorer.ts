/**
 * Analytics explorer (ANALYTICS_API.md §6): the exploration config, the catalog and the builder
 * rules. The pivot itself is in utils/global-explorer.ts.
 *
 * The catalog (`GET /analytics/variables`) says which metric splits by which dimension. An id the
 * client can't compute is left out of the builder instead of guessed.
 */
import type { PlayerSeason } from './analytics'

/* ---------------------------------------------------------------- *
 * API shapes (§6.1, §6.2)
 * ---------------------------------------------------------------- */

export type Technique = 'table' | 'heatmap' | 'bars' | 'line'
/** `days` and `groups` only exist in the global catalog (§7), `rating` only in the duelist's. */
export type Source = 'games' | 'cards' | 'handTraps' | 'rating' | 'days' | 'groups'
/** How a source reads in a sentence. */
export const SOURCE_NAME: Record<Source, string> = { games: 'games', cards: 'cards', handTraps: 'hand traps', rating: 'daily rating', days: 'days', groups: 'engines & techs' }
/** `number[]`: a global archetype, one setcode or two for a mixed deck (§7). */
export type FilterValue = string | number | number[] | null

type Dimension = { id: string; label: string; values: string; description: string }
/** `last` = the value of the latest point in the cut, never summed or averaged. */
export type Metric = { id: string; label: string; source: Source; format: 'count' | 'rate' | 'average' | 'last'; splitBy: string[]; from: string; description: string }
type Limits = { segments: number; rows: number; columns: number; values: number; filters: number; explorations: number; name: number; rowLimit: number }

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
  /** Columns shown when `columns` is set. Absent = 8. */
  columnLimit?: number
  /** Column order. Absent/`null` = the dimension's natural order, else most samples first. */
  columnSort?: ColumnSort | null
  /** Row filters on a metric, like SQL `HAVING`: all must hold. 0–3, one per `(value, op)`. Absent = none. */
  thresholds?: Threshold[]
}

export type ThresholdOp = 'gt' | 'gte' | 'lt' | 'lte'
/** `value` indexes `values`; `target` is in the metric's unit (a rate is 0..1). */
export type Threshold = { value: number; op: ThresholdOp; target: number }
export const THRESHOLD_OPS: { id: ThresholdOp; label: string }[] = [
  { id: 'gt', label: '>' },
  { id: 'gte', label: '≥' },
  { id: 'lt', label: '<' },
  { id: 'lte', label: '≤' },
]
const holds = (v: number | null, { op, target }: Threshold) =>
  v !== null && (op === 'gt' ? v > target : op === 'gte' ? v >= target : op === 'lt' ? v < target : v <= target)

/** Keeps the rows where some segment's aggregate passes every threshold. Runs before sort and limit. */
export const applyThresholds = <G extends { seg: GroupSegment[] }>(order: G[], cfg: ExplorationConfig) => {
  const ts = cfg.thresholds ?? []
  return ts.length ? order.filter((g) => g.seg.some((s) => ts.every((t) => holds(s.vals[t.value] ?? null, t)))) : order
}

export type ColumnSort = 'samples' | 'value' | 'label'
export const COLUMN_SORTS: { id: ColumnSort; label: string }[] = [
  { id: 'samples', label: 'Most samples' },
  { id: 'value', label: 'Highest value' },
  { id: 'label', label: 'A–Z' },
]
export const COLUMN_LIMIT = 8

/** The columns in the config's order, capped at `columnLimit`. `valueOf` = the first metric over the whole column. */
export const pickColumns = <C extends { sk: number | string; n: number; label: string }>(all: C[], cfg: ExplorationConfig, natural: boolean, valueOf: (c: C) => number | null) => {
  const by = cfg.columnSort ?? (natural ? null : 'samples')
  const val = by === 'value' ? new Map(all.map((c) => [c, valueOf(c) ?? -Infinity])) : null
  const sorted = [...all].sort(
    by === 'samples' ? (a, b) => b.n - a.n
      : val ? (a, b) => val.get(b)! - val.get(a)!
        : by === 'label' ? (a, b) => a.label.localeCompare(b.label)
          : (a, b) => (a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0),
  )
  return sorted.slice(0, cfg.columnLimit ?? COLUMN_LIMIT)
}

/** A season the Segments panel offers. `code` resolves `current:*`; `null` when that ladder has no open season. */
export type SegmentOption = { id: string; label: string; sub: string; code: string | null }

/** A staff period (`GET /analytics/periods`): any window, compared like a season. Ends exclusive, UTC days. */
export type AnalyticsPeriod = PlayerSeason['season'] & { endsAt: string }

/** The primary segment's note. */
export const seasonState = (s: PlayerSeason['season']) => (s.analyticsOnly ? 'Period' : s.endsAt ? 'Ended' : 'Open')

/** `TCG · 09.2026`, or `Current TCG · 09.2026` for a segment that follows the open season. */
export const segmentLabel = (id: string, season: PlayerSeason['season']) =>
  `${id.startsWith('current:') ? 'Current ' : ''}${season.ladder === 'genesys' ? 'Genesys' : 'TCG'} · ${season.label}`

/** Dimensions with an order of their own: rows keep it instead of sorting by metric. */
const NATURAL: Record<string, 'asc' | 'desc'> = { turnOrder: 'asc', gameNumber: 'asc', result: 'asc', match: 'desc', seasonDay: 'asc', activatedBy: 'asc' }
export const dimNatural = (d: string) => NATURAL[d]

/** Win/loss rates: 50% is the line that matters. */
export const WIN_LOSS = new Set(['winRate', 'winRateWhenUsed', 'winRateInDeck', 'dailyWinRate', 'winRateWithGroup'])

/* ---------------------------------------------------------------- *
 * The catalog, narrowed to what this client computes
 * ---------------------------------------------------------------- */

export type Catalog = {
  limits: Limits
  techniques: Technique[]
  dimensions: Map<string, Dimension>
  metrics: Map<string, Metric>
}

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

type Cell = { value: number | null; n: number }
export type GroupSegment = { vals: (number | null)[]; n: number; cells: Cell[] }
export type Group = { key: string; labels: string[]; values: FilterValue[]; matchId: string | null; sub: string; seg: GroupSegment[] }

/** What the output draws. utils/global-explorer.ts produces it. */
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
  // Thresholds index `values`: drop the removed metric's, shift the ones after it.
  if (zone === 'values' && t.thresholds) t.thresholds = t.thresholds.filter((h) => h.value !== i).map((h) => (h.value > i ? { ...h, value: h.value - 1 } : h))
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

const SEG_COLORS = ['var(--color-cyan)', 'var(--color-cyan)', 'var(--color-azure-lift)', 'var(--color-ink-dim)']
/** One colour per compared season, in the order they were added. */
export const segColor = (i: number) => SEG_COLORS[i] ?? 'var(--color-ink-dim)'
