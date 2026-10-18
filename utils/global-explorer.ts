/**
 * Global analytics (ANALYTICS_API.md §7): the same builder as the duelist's, over every ranked duel.
 *
 * The sample is one deck in one game, and the season answer is tuple tables of sums, not per-game
 * rows: a cut adds the rows it keeps, then divides. Mirror matches (same archetype both sides) stay
 * in counts and meta share but never in a win rate. Archetypes are setcode lists (`[349]`, or
 * `[240, 349]` for a mixed deck), named from `names` and compared by value. The `…Part` dimensions
 * take one setcode, and a mixed deck counts under each of its own.
 * Cuts below `minSamples` are hidden here: the server can't, the cut is made on the client.
 */
import { cache } from 'react'
import { API_URL } from '@utils/auth'
import { AnalyticsApiError, type PlayerSeason } from '@utils/analytics'
import {
  SOURCE_NAME, applyThresholds, fmt, pickColumns, segColor, segmentLabel, sortGroups,
  type Catalog, type ExplorationConfig, type FilterValue, type Group, type GroupSegment, type LineData, type PivotResult, type Source, type Variables,
} from './explorer'

/* ---------------------------------------------------------------- *
 * API shapes and calls (§7.1–7.3)
 * ---------------------------------------------------------------- */

type N = number
/** Setcodes, ascending: one for a pure deck, two for a mixed one. `null` = unknown. */
type A = N[] | null
export type GlobalSeason = {
  season: PlayerSeason['season']
  /** Days in the sweep's timezone. `first`/`last` are `null` before the first sweep. */
  syncedDays: { count: number; first: string | null; last: string | null }
  minSamples: number
  /** [arch, opp, wentFirst, gameNumber, outcome, samples, turns, ownTurns, ownActions, turn1SpecialSummons, longestChain] */
  games: [A, A, 0 | 1, N, 1 | -1 | 0 | null, N, N, N, N, N, N][]
  /** [seasonDay, arch, samples, wins, losses, draws] — mirrors already out of W/L/D. */
  days: [N, A, N, N, N, N][]
  /** [cardId, arch, samples, copies, used, usedWins, usedLosses, usedDraws, wins, losses, draws] — mirrors already out of W/L/D. */
  cards: [N, A, N, N, N, N, N, N, N, N, N][]
  /** [groupId, arch, samples, wins, losses, draws] */
  groups: [N, A, N, N, N, N][]
  /**
   * [cardId, activatorArch, otherArch, activations, responded, calledByTheGrave, crossoutDesignator,
   *  ashedOrPurged, ashCounted] — `ashCounted` = responses counted while Ash'd or Purged existed (0 on older days).
   */
  handTraps: [N, A, A, N, N, N, N, N, N][]
  names: {
    archetypes: Record<string, string>
    cards: Record<string, string>
    groups: Record<string, { name: string; kind: 'engine' | 'tech'; handTrap: boolean }>
  }
}

export type GlobalExploration = {
  id: string
  name: string
  description: string
  /** Order of the public list, set in the panel. */
  position: number
  config: ExplorationConfig
  /** `false` = draft, panel only. `true` = public to anyone. */
  published: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

const get = async <T>(path: string, init?: RequestInit): Promise<T | null> => {
  const res = await fetch(`${API_URL}${path}`, init)
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new AnalyticsApiError(res.status, body.error, body.message)
  }
  return res.json()
}

/** `GET /analytics/global/variables`: constant, cached an hour. */
export const getGlobalVariables = cache(async () => (await get<Variables>('/analytics/global/variables', { next: { revalidate: 3600 } }))!)

/** `GET /analytics/global/seasons/:code`: several MB, cached 5 minutes by the API. `null` for an unknown season. */
export const getGlobalSeason = (code: string) => get<GlobalSeason>(`/analytics/global/seasons/${encodeURIComponent(code)}`)

export type TopDeck = {
  archetype: number[]
  /** `A / B` for a mixed deck; `null` when a setcode has no name. */
  name: string | null
  metaShare: number
  /** The 3 cards used in the most deck-games of the archetype. */
  topCards: { id: number; name: string | null }[]
}

/** `GET /analytics/global/top-decks`: best archetypes of the format's open season. `null` with no open season. */
export const getTopDecks = async (format: 'tcg' | 'genesys', decks = 10) =>
  (await get<{ decks: TopDeck[] }>(`/analytics/global/top-decks?ladder=${format}&decks=${decks}`, { next: { revalidate: 300 } }))?.decks ?? null

/* ---------------------------------------------------------------- *
 * Facts: one per tuple (two per hand-trap row, one from each deck's side)
 * ---------------------------------------------------------------- */

type Fact = {
  /** The tuple. Hand-trap rows have two facts sharing it; a cut without `activatedBy` counts it once. */
  row: object
  dims: Record<string, FilterValue>
  n: Record<string, number>
  /** Same known archetype on both sides: out of every win rate. */
  mirror: boolean
}

export type GlobalSegment = {
  id: string
  label: string
  season: GlobalSeason
  /** Last season day with data. */
  days: number
  facts: Partial<Record<Source, Fact[]>>
}

const RESULT: Record<string, string> = { '1': 'win', '-1': 'loss', '0': 'draw', null: 'none' }
/** Archetypes compare by value: `[240, 349]` is `"240+349"`. */
const archKey = (a: A) => a?.join('+') ?? null

export const buildGlobalSegment = (id: string, season: GlobalSeason): GlobalSegment => {
  const kind = (g: number) => season.names.groups[g]?.kind
  const days = season.days.map((r) => ({
    row: r, mirror: false,
    dims: { seasonDay: r[0], archetype: r[1] },
    n: { samples: r[2], w: r[3], l: r[4], d: r[5] },
  }))
  return {
    id, season,
    label: segmentLabel(id, season.season),
    days: Math.max(1, ...days.map((f) => f.dims.seasonDay as number)),
    facts: {
      games: season.games.map((r) => ({
        row: r,
        mirror: r[0] !== null && archKey(r[0]) === archKey(r[1]),
        dims: { archetype: r[0], opponentArchetype: r[1], turnOrder: r[2] ? 'first' : 'second', gameNumber: r[3], result: RESULT[String(r[4])]! },
        n: { samples: r[5], turns: r[6], ownTurns: r[7], ownActions: r[8], t1: r[9], chain: r[10], outcome: r[4] ?? NaN, first: r[2] },
      })),
      days,
      cards: season.cards.map((r) => ({
        row: r, mirror: false,
        dims: { card: r[0], archetype: r[1] },
        n: { samples: r[2], copies: r[3], used: r[4], uw: r[5], ul: r[6], ud: r[7], w: r[8], l: r[9], d: r[10] },
      })),
      // A group staff deleted has no kind: it can't answer Engine or Tech, only the archetype.
      groups: season.groups.map((r) => ({
        row: r, mirror: false,
        dims: { archetype: r[1], ...(kind(r[0]) ? { [kind(r[0])!]: r[0] } : {}) },
        n: { samples: r[2], w: r[3], l: r[4], d: r[5] },
      })),
      handTraps: season.handTraps.flatMap((r) => {
        const n = { activations: r[3], responded: r[4], called: r[5], crossout: r[6], ashed: r[7], ashCounted: r[8] }
        return [
          { row: r, mirror: false, n, dims: { handTrap: r[0], activatedBy: 'deck', archetype: r[1], opponentArchetype: r[2] } },
          { row: r, mirror: false, n, dims: { handTrap: r[0], activatedBy: 'opponent', archetype: r[2], opponentArchetype: r[1] } },
        ]
      }),
    },
  }
}

export type GlobalNames = { archetypes: Record<string, string>; cards: Record<string, string>; groups: GlobalSeason['names']['groups'] }

export const globalNamesOf = (segs: GlobalSegment[]): GlobalNames => ({
  archetypes: Object.assign({}, ...segs.map((s) => s.season.names.archetypes)),
  cards: Object.assign({}, ...segs.map((s) => s.season.names.cards)),
  groups: Object.assign({}, ...segs.map((s) => s.season.names.groups)),
})

/* ---------------------------------------------------------------- *
 * Dimensions
 * ---------------------------------------------------------------- */

const ORDER: Record<string, Record<string, number>> = {
  turnOrder: { first: 0, second: 1 },
  result: { win: 0, loss: 1, draw: 2, none: 3 },
  activatedBy: { deck: 0, opponent: 1 },
}
const LABEL: Record<string, Record<string, string>> = {
  turnOrder: { first: 'Going first', second: 'Going second' },
  result: { win: 'Win', loss: 'Loss', draw: 'Draw', none: 'No result' },
  activatedBy: { deck: 'By the deck', opponent: 'Against the deck' },
}
/** A `…Part` dimension reads one setcode of its whole-archetype dimension. */
const PART: Record<string, string> = { archetypePart: 'archetype', opponentArchetypePart: 'opponentArchetype' }
const KNOWN_DIMS = new Set(['archetype', 'opponentArchetype', ...Object.keys(PART), 'turnOrder', 'gameNumber', 'result', 'seasonDay', 'card', 'engine', 'tech', 'handTrap', 'activatedBy'])
/** Dimensions of `games` rows: they narrow the deck-games a rate divides by. */
const GAME_DIMS = ['archetype', 'opponentArchetype', ...Object.keys(PART), 'turnOrder', 'gameNumber', 'result']

/** Every value a fact takes on `d`: one, or each setcode for a `…Part` dimension. `[]` = doesn't apply. */
const dimValues = (d: string, f: Fact): FilterValue[] => {
  const base = PART[d]
  if (base) return base in f.dims ? ((f.dims[base] as A) ?? [null]) : []
  return d in f.dims ? [f.dims[d]!] : []
}
const same = (a: FilterValue, b: FilterValue) => a === b || (Array.isArray(a) && Array.isArray(b) && a.join('+') === b.join('+'))
const dimKey = (d: string, v: FilterValue) => ORDER[d]?.[String(v)] ?? (typeof v === 'number' ? v : String(v))

export const globalDimLabel = (d: string, v: FilterValue, names: GlobalNames) => {
  // Mixed deck = [a, b] (or "a,b" once stringified); names are per setcode.
  if (d === 'archetype' || d === 'opponentArchetype' || d in PART)
    return v === null ? 'Unknown' : String(v).split(/[,+]/).map((c) => names.archetypes[c] ?? `#${c}`).join(' / ')
  if (d === 'card' || d === 'handTrap') return names.cards[String(v)] ?? `#${v}`
  if (d === 'engine' || d === 'tech') return names.groups[String(v)]?.name ?? 'Deleted group'
  if (d === 'gameNumber') return `Game ${v}`
  if (d === 'seasonDay') return `Day ${String(v).padStart(2, '0')}`
  return LABEL[d]?.[String(v)] ?? String(v)
}

/* ---------------------------------------------------------------- *
 * Metrics: sum the rows of the cut, then divide
 * ---------------------------------------------------------------- */

type Cut = Record<string, FilterValue>
/** `base`: the filters alone, the population a share divides by. */
type Ctx = { facts: Fact[]; cut: Cut; base: Cut; seg: GlobalSegment; extra?: (f: Fact) => boolean }

const ratio = (a: number, b: number) => (b ? a / b : null)
const S = (facts: Fact[], k: string) => facts.reduce((n, f) => n + (f.n[k] ?? 0), 0)
const matches = (f: Fact, cut: Cut) => Object.entries(cut).every(([d, v]) => dimValues(d, f).some((x) => same(x, v)))
/** Every combination of values a fact takes on `dims`: more than one only through a `…Part` dimension. */
const combos = (dims: string[], f: Fact) =>
  dims.reduce<FilterValue[][]>((acc, d) => acc.flatMap((c) => dimValues(d, f).map((v) => [...c, v])), [[]])
/** Deck-games of the cut's game dimensions: the denominator of inclusion and per-game rates. */
const gamesOf = ({ seg, cut, extra }: Ctx) => {
  const gc = Object.fromEntries(Object.entries(cut).filter(([d]) => GAME_DIMS.includes(d)))
  const count = () => S((seg.facts.games ?? []).filter((f) => matches(f, gc) && (!extra || extra(f))), 'samples')
  if (extra) return count()
  // Thousands of card rows share a handful of archetype cuts: scan the 30k game rows once per cut.
  const memo = gamesMemo.get(seg) ?? new Map<string, number>()
  gamesMemo.set(seg, memo)
  const key = JSON.stringify(gc)
  if (!memo.has(key)) memo.set(key, count())
  return memo.get(key)!
}
const gamesMemo = new WeakMap<GlobalSegment, Map<string, number>>()
/** Hand-trap facts: one per tuple unless the cut says whose side. */
const traps = ({ facts, cut }: Ctx) => ('activatedBy' in cut ? facts : [...new Map(facts.map((f) => [f.row, f])).values()])
const rated = (facts: Fact[]) => facts.filter((f) => !f.mirror)
const outcome = (facts: Fact[], o: number) => S(rated(facts).filter((f) => f.n.outcome === o), 'samples')
const gameRate = (facts: Fact[]) => ratio(outcome(facts, 1), outcome(facts, 1) + outcome(facts, -1) + outcome(facts, 0))
const tallyRate = (facts: Fact[]) => ratio(S(facts, 'w'), S(facts, 'w') + S(facts, 'l') + S(facts, 'd'))

const COMPUTE: Record<string, (ctx: Ctx) => number | null> = {
  samples: ({ facts }) => S(facts, 'samples'),
  matches: ({ facts }) => S(facts.filter((f) => f.dims.gameNumber === 1), 'samples'),
  metaShare: (ctx) => ratio(S(ctx.facts, 'samples'), gamesOf({ ...ctx, cut: ctx.base, extra: undefined })),
  wins: ({ facts }) => outcome(facts, 1),
  losses: ({ facts }) => outcome(facts, -1),
  draws: ({ facts }) => outcome(facts, 0),
  winRate: ({ facts }) => gameRate(facts),
  averageTurns: ({ facts }) => ratio(S(facts, 'turns'), S(facts, 'samples')),
  comboLength: ({ facts }) => ratio(S(facts, 'ownActions'), S(facts, 'ownTurns')),
  turn1SpecialSummons: ({ facts }) => {
    const first = facts.filter((f) => f.n.first === 1)
    return ratio(S(first, 't1'), S(first, 'samples'))
  },
  longestChain: ({ facts }) => ratio(S(facts, 'chain'), S(facts, 'samples')),

  dailySamples: ({ facts }) => S(facts, 'samples'),
  dailyMetaShare: ({ facts, seg, cut, base, extra }) => {
    const day = (seg.facts.days ?? []).filter((f) => matches(f, base) && (!('seasonDay' in cut) || f.dims.seasonDay === cut.seasonDay) && (!extra || extra(f)))
    return ratio(S(facts, 'samples'), S(day, 'samples'))
  },
  dailyWinRate: ({ facts }) => tallyRate(facts),

  inclusion: (ctx) => ratio(S(ctx.facts, 'samples'), gamesOf(ctx)),
  inclusionSamples: ({ facts }) => S(facts, 'samples'),
  averageCopies: ({ facts }) => ratio(S(facts, 'copies'), S(facts, 'samples')),
  usage: ({ facts }) => ratio(S(facts, 'used'), S(facts, 'samples')),
  usedSamples: ({ facts }) => S(facts, 'used'),
  winRateInDeck: ({ facts }) => tallyRate(facts),
  winRateWhenUsed: ({ facts }) => ratio(S(facts, 'uw'), S(facts, 'uw') + S(facts, 'ul') + S(facts, 'ud')),

  groupSamples: ({ facts }) => S(facts, 'samples'),
  groupInclusion: (ctx) => ratio(S(ctx.facts, 'samples'), gamesOf(ctx)),
  winRateWithGroup: ({ facts }) => tallyRate(facts),

  activations: (ctx) => S(traps(ctx), 'activations'),
  activationsPerGame: (ctx) => ratio(S(traps(ctx), 'activations'), gamesOf(ctx)),
  responded: (ctx) => S(traps(ctx), 'responded'),
  respondedRate: (ctx) => ratio(S(traps(ctx), 'responded'), S(traps(ctx), 'activations')),
  calledByTheGrave: (ctx) => S(traps(ctx), 'called'),
  calledByTheGraveRate: (ctx) => ratio(S(traps(ctx), 'called'), S(traps(ctx), 'responded')),
  crossoutDesignator: (ctx) => S(traps(ctx), 'crossout'),
  crossoutDesignatorRate: (ctx) => ratio(S(traps(ctx), 'crossout'), S(traps(ctx), 'responded')),
  ashedOrPurged: (ctx) => S(traps(ctx), 'ashed'),
  // Only when every response in the cut was counted while Ash'd or Purged existed: never a blend.
  ashedOrPurgedRate: (ctx) => {
    const rows = traps(ctx)
    return S(rows, 'ashCounted') === S(rows, 'responded') ? ratio(S(rows, 'ashed'), S(rows, 'responded')) : null
  },
}

/** What a cut's sample is: deck-games, or activations for hand traps. Compared to `minSamples`. */
const sampleOf = (source: Source, facts: Fact[], cut: Cut) =>
  source === 'handTraps' ? S(traps({ facts, cut } as Ctx), 'activations') : S(facts, 'samples')

export const globalCatalogOf = (vars: Variables): Catalog => ({
  limits: vars.limits,
  techniques: vars.techniques,
  dimensions: new Map(vars.dimensions.filter((d) => KNOWN_DIMS.has(d.id)).map((d) => [d.id, d])),
  metrics: new Map(vars.metrics.filter((m) => m.id in COMPUTE).map((m) => [m.id, { ...m, splitBy: m.splitBy.filter((d) => KNOWN_DIMS.has(d)) }])),
})

/* ---------------------------------------------------------------- *
 * Pivot
 * ---------------------------------------------------------------- */

const measure = (id: string, seg: GlobalSegment, facts: Fact[], cut: Cut, base: Cut, extra?: (f: Fact) => boolean) => COMPUTE[id]!({ facts, cut, base, seg, extra })

export const runGlobal = (cat: Catalog, segs: GlobalSegment[], cfg: ExplorationConfig, names: GlobalNames): PivotResult => {
  const values = cfg.values.filter((m) => cat.metrics.has(m))
  const source = cat.metrics.get(values[0] ?? '')?.source ?? 'games'
  const rowDims = cfg.rows.filter((d) => KNOWN_DIMS.has(d))
  const colDim = cfg.columns && KNOWN_DIMS.has(cfg.columns) ? cfg.columns : null
  const filterCut: Cut = Object.fromEntries(cfg.filters.map((f) => [f.dimension, f.value]))
  const min = Math.max(0, ...segs.map((s) => s.season.minSamples ?? 0))
  let hidden = 0

  const groups = new Map<string, { key: string; values: FilterValue[]; rows: Fact[][]; cols: Map<string, Fact[]>[] }>()
  const colVals = new Map<string, { v: FilterValue; sk: number | string; n: number }>()
  segs.forEach((seg, si) => {
    for (const f of (seg.facts[source] ?? []).filter((f) => matches(f, filterCut))) {
      for (const vals of combos(rowDims, f)) {
        const key = JSON.stringify(vals)
        const g = groups.get(key) ?? { key, values: vals, rows: segs.map((): Fact[] => []), cols: segs.map(() => new Map()) }
        groups.set(key, g)
        g.rows[si]!.push(f)
        for (const cv of colDim ? dimValues(colDim, f) : []) {
          const ck = JSON.stringify(cv)
          const c = colVals.get(ck) ?? { v: cv, sk: dimKey(colDim!, cv), n: 0 }
          c.n += f.n.samples ?? f.n.activations ?? 0
          colVals.set(ck, c)
          g.cols[si]!.set(ck, [...(g.cols[si]!.get(ck) ?? []), f])
        }
      }
    }
  })

  const colAll = [...colVals.values()].map((c) => ({ ...c, label: globalDimLabel(colDim!, c.v, names) }))
  const colList = pickColumns(colAll, cfg, !!colDim && (!!ORDER[colDim] || colDim === 'gameNumber'), (c) => {
    const cut = { ...filterCut, [colDim!]: c.v }
    const s = segs[0]
    return values[0] && s ? measure(values[0], s, (s.facts[source] ?? []).filter((f) => matches(f, cut)), cut, filterCut) : null
  })

  const order = [...groups.values()].map((g) => {
    const cut: Cut = { ...filterCut, ...Object.fromEntries(rowDims.map((d, i) => [d, g.values[i]!])) }
    const seg: GroupSegment[] = segs.map((s, si) => {
      const rows = g.rows[si]!
      const n = sampleOf(source, rows, cut)
      const small = n < min
      return {
        n,
        vals: values.map((m) => (small ? null : measure(m, s, rows, cut, filterCut))),
        cells: colDim
          ? colList.map((c) => {
            const cellCut = { ...cut, [colDim]: c.v }
            const cellRows = g.cols[si]!.get(JSON.stringify(c.v)) ?? []
            const cn = sampleOf(source, cellRows, cellCut)
            return { n: cn, value: values[0] && cn >= min && cn ? measure(values[0], s, cellRows, cellCut, filterCut) : null }
          })
          : [],
      }
    })
    return {
      key: g.key, values: g.values, matchId: null, sub: '', seg,
      sk: rowDims.map((d, i) => dimKey(d, g.values[i]!)),
      labels: rowDims.length ? rowDims.map((d, i) => globalDimLabel(d, g.values[i]!, names)) : [`All ${SOURCE_NAME[source]}`],
    }
  }).filter((g) => {
    const shown = g.seg.some((s) => s.n >= min && s.n > 0)
    if (!shown) hidden++
    return shown
  })
  const kept = applyThresholds(order, cfg)
  sortGroups(kept, rowDims, cfg)

  return {
    source, values, rowDims, colDim,
    segs: segs.map((s, i) => ({ id: s.id, label: s.label, color: segColor(i) })),
    groups: kept.slice(0, cfg.limit || 12) as Group[],
    totalGroups: kept.length,
    colList,
    hiddenCols: colAll.length - colList.length,
    totals: source === 'games' || source === 'days'
      ? segs.map((s) => {
        const rows = (s.facts[source] ?? []).filter((f) => matches(f, filterCut))
        return { count: S(rows, 'samples'), vals: values.map((m) => measure(m, s, rows, filterCut, filterCut)) }
      })
      : null,
    unit: source === 'handTraps' ? 'activations' : 'deck-games',
    note: [
      hidden ? `${hidden} row${hidden === 1 ? '' : 's'} under ${min} ${source === 'handTraps' ? 'activations' : 'deck-games'} hidden` : '',
      ...segs.map((s) => (s.season.syncedDays.last ? '' : `${s.label}: not swept yet`)),
    ].filter(Boolean).join(' · '),
  }
}

/** One series per season, or per column value when a single season is split by Columns. Only `days` rows carry a day. */
export const globalLineSeries = (segs: GlobalSegment[], res: PivotResult, cfg: ExplorationConfig): LineData => {
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
        const inDay = (f: Fact) => (cfg.runningTotal ? (f.dims.seasonDay as number) <= day : f.dims.seasonDay === day)
        const rows = (se.seg.facts.days ?? []).filter((f) => inDay(f) && matches(f, se.cut))
        return { day, value: rows.length ? measure(metric, se.seg, rows, se.cut, filterCut, inDay) : null }
      }),
    })),
  }
}

/** Every value a dimension takes in these seasons, in its natural order, labelled. */
export const globalValuesOf = (segs: GlobalSegment[], dim: string, source: Source, names: GlobalNames) => {
  const seen = new Map<string, { v: FilterValue; k: number | string; n: number }>()
  for (const seg of segs) {
    for (const f of seg.facts[source] ?? []) {
      for (const v of dimValues(dim, f)) {
        const e = seen.get(JSON.stringify(v)) ?? { v, k: dimKey(dim, v), n: 0 }
        e.n += f.n.samples ?? f.n.activations ?? 0
        seen.set(JSON.stringify(v), e)
      }
    }
  }
  // Natural dimensions keep their order; archetypes, cards and groups come most played first.
  const natural = !!ORDER[dim] || dim === 'gameNumber' || dim === 'seasonDay'
  return [...seen.values()]
    .sort(natural ? (a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0) : (a, b) => b.n - a.n)
    .map(({ v }) => ({ v, label: globalDimLabel(dim, v, names) }))
}

/* ---------------------------------------------------------------- *
 * Header numbers
 * ---------------------------------------------------------------- */

export const globalKpis = (seg: GlobalSegment, names: GlobalNames) => {
  const games = seg.facts.games ?? []
  const byArch = new Map<string | null, [A, number]>()
  for (const f of games) {
    const a = f.dims.archetype as A
    byArch.set(archKey(a), [a, (byArch.get(archKey(a))?.[1] ?? 0) + f.n.samples!])
  }
  const [top] = [...byArch.values()].filter(([a]) => a !== null).sort((a, b) => b[1] - a[1])
  const all = S(games, 'samples')
  const first = gameRate(games.filter((f) => f.n.first === 1))
  const { syncedDays } = seg.season
  return [
    { label: 'Deck-games', value: fmt(all, 'count'), note: `${fmt(COMPUTE.matches!({ facts: games, cut: {}, base: {}, seg }), 'count')} matches` },
    { label: 'Archetypes', value: fmt(byArch.size, 'count'), note: 'seen at least once' },
    { label: 'Top archetype', value: top ? globalDimLabel('archetype', top[0], names) : '—', note: top ? `${fmt(top[1] / all, 'rate')} of the meta` : '', tone: 'text-cyan' },
    { label: 'Going first', value: fmt(first, 'rate'), note: 'win rate, mirrors out' },
    { label: 'Data', value: fmt(syncedDays.count, 'count'), note: syncedDays.last ? `days, through ${syncedDays.last}` : 'no day swept yet' },
  ]
}
