'use client'

/**
 * Deck ranking: five ways to explore the meta, each with its own question, highlights, chart and columns.
 * Most played (what will I face?), Top win rate (what works, with how much evidence?), Rising (what is
 * changing?), Sleeper (what am I missing?), Most consistent (what can I rely on?).
 */

import { useCallback, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Segmented } from '@ui/choice'
import { Chip } from '@ui/chip'
import { Icon } from '@ui/icon'
import { Lookup, type LookupOption } from '@ui/lookup'
import { Panel } from '@ui/panel'
import { TabBar } from '@ui/tab-bar'
import { archKey, deckHref, getArchetypeIndex, growthDays, RANKING_MODES, statisticsHref, strengthOf, type RankingMode, type StatArchetype, type Statistics, type StatisticsScope, type TrendPoint } from '@utils/statistics'
import { Art, Bar, faceOf, nameOf, NOTE, num, NUM, pct, ROW, SortHeads, sortBy, useSort, type Getters } from '../DeepDive'
import { at } from './MatchupMatrix'

type DeckRankingProps = {
  data: Statistics
  scope: StatisticsScope
}

const FOLD = 14
const TIER_COLOR = { 1: 'text-cyan', 1.5: 'text-azure-lift', 2: 'text-ink', 3: 'text-ink-dim', 4: 'text-ink-muted' } as const
const SERIES = ['series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6'] as const
// ponytail: product parameters for the sleeper rule, not statistics; tune them when the list looks wrong.
const SLEEPER = { share: 0.02, games: 1000 }
/** Daily win rates needed before a deck gets a stability reading. */
const MIN_DAYS = 3
const MIN_GAMES = [0, 500, 2000, 10000] as const

const pp = (v: number, signed = true) => `${signed && v > 0 ? '+' : ''}${(v * 100).toFixed(1)} pp`

// ---- derived from the daily series

type Stability = { mean: number; sd: number; floor: number; days: number }

/** Days with a win rate, each weighted by its games (1 each from an older server without them). */
const daily = (points?: TrendPoint[]) => (points ?? []).flatMap(([, , wr, g]) => (wr == null ? [] : [{ wr, w: g ?? 1 }]))

/** Weighted mean and standard deviation of the daily win rate, plus its 20th percentile as the floor. */
const stabilityOf = (points?: TrendPoint[]): Stability | null => {
  const d = daily(points)
  if (d.length < MIN_DAYS) return null
  const W = d.reduce((s, x) => s + x.w, 0)
  const mean = d.reduce((s, x) => s + x.wr * x.w, 0) / W
  const sd = Math.sqrt(d.reduce((s, x) => s + x.w * (x.wr - mean) ** 2, 0) / W)
  // ponytail: unweighted percentile; a weighted one if a 30-game day ever shows up as a floor.
  const sorted = d.map((x) => x.wr).sort((a, b) => a - b)
  return { mean, sd, floor: sorted[Math.floor((sorted.length - 1) * 0.2)]!, days: d.length }
}

/** Weighted mean of `field` over the last `days` points minus the `days` before; null without both windows. */
const windowChange = (points: TrendPoint[] | undefined, days: number, field: 1 | 2, offset = 0) => {
  if (!points) return null
  const end = points.length - offset
  const recent = points.slice(Math.max(0, end - days), end), before = points.slice(Math.max(0, end - 2 * days), Math.max(0, end - days))
  if (recent.length < days || before.length < days) return null
  const mean = (ps: TrendPoint[]) => {
    const xs = ps.flatMap((p) => (p[field] == null ? [] : [{ v: p[field]!, w: field === 2 ? (p[3] ?? 1) : 1 }]))
    const W = xs.reduce((s, x) => s + x.w, 0)
    return W ? xs.reduce((s, x) => s + x.v * x.w, 0) / W : null
  }
  const a = mean(recent), b = mean(before)
  return a == null || b == null ? null : a - b
}

type Kind = 'accelerating' | 'steady' | 'recovering' | 'cooling'
const kindOf = (growth: number | null | undefined, prior: number | null): Kind | null => {
  if (growth == null || prior == null) return null
  if (growth > 0) return prior < 0 ? 'recovering' : growth > prior * 1.25 ? 'accelerating' : 'steady'
  return 'cooling'
}
const KIND_TONE: Record<Kind, 'positive' | 'cyan' | 'gold' | 'negative'> = { accelerating: 'positive', steady: 'cyan', recovering: 'gold', cooling: 'negative' }

type Row = {
  a: StatArchetype
  key: string
  points?: TrendPoint[]
  stab: Stability | null
  /** Share change in the window before `growth`'s. */
  prior: number | null
  /** Win rate change, last window against the one before. */
  wrChange: number | null
  kind: Kind | null
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0
}

// ---- small charts

type Dot = { key: string; name: string; x: number; y: number; size: number; hot?: boolean }

/** Dots on two axes with optional guide lines; the `labels` largest get a name. */
const Scatter = ({ dots, xLog, guides, fmtX, fmtY, labels = 6, quadrants }: { dots: Dot[]; xLog?: boolean; guides?: { x?: number; y?: number }; fmtX: (v: number) => string; fmtY: (v: number) => string; labels?: number; quadrants?: [string, string, string, string] }) => {
  const W = 640, H = 300, L = 48, R = 16, T = 16, B = 32
  if (!dots.length) return null
  const tx = (v: number) => (xLog ? Math.log10(Math.max(1, v)) : v)
  const xs = dots.map((d) => tx(d.x)), ys = dots.map((d) => d.y)
  const x0 = Math.min(...xs, guides?.x != null ? tx(guides.x) : Infinity), x1 = Math.max(...xs, guides?.x != null ? tx(guides.x) : -Infinity)
  const y0 = Math.min(...ys, guides?.y ?? Infinity), y1 = Math.max(...ys, guides?.y ?? -Infinity)
  const padX = (x1 - x0 || 1) * 0.08, padY = (y1 - y0 || 0.02) * 0.15
  const X = (v: number) => L + ((tx(v) - (x0 - padX)) / (x1 - x0 + 2 * padX)) * (W - L - R)
  const Y = (v: number) => T + (1 - (v - (y0 - padY)) / (y1 - y0 + 2 * padY)) * (H - T - B)
  const maxSize = Math.max(...dots.map((d) => d.size), 1e-9)
  const rOf = (d: Dot) => 4 + Math.sqrt(d.size / maxSize) * 14
  const named = new Set([...dots].sort((a, b) => b.size - a.size).slice(0, labels).map((d) => d.key))
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => y0 - padY + f * (y1 - y0 + 2 * padY))
  const xTicks = [0, 0.33, 0.66, 1].map((f) => { const v = x0 - padX + f * (x1 - x0 + 2 * padX); return xLog ? 10 ** v : v })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full text-ink-muted">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--color-line)" strokeDasharray="3 4" />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" className="font-mono">{fmtY(v)}</text>
        </g>
      ))}
      {xTicks.map((v, i) => (
        <text key={i} x={X(v)} y={H - 10} textAnchor="middle" fontSize="11" fill="currentColor" className="font-mono">{fmtX(v)}</text>
      ))}
      {guides?.y != null ? <line x1={L} x2={W - R} y1={Y(guides.y)} y2={Y(guides.y)} stroke="var(--color-line-strong)" /> : null}
      {guides?.x != null ? <line y1={T} y2={H - B} x1={X(guides.x)} x2={X(guides.x)} stroke="var(--color-line-strong)" /> : null}
      {quadrants && guides?.x != null && guides.y != null ? (
        <>
          <text x={L + 8} y={T + 14} fontSize="11" fill="var(--color-win)" className="signal-sm">{quadrants[0]}</text>
          <text x={W - R - 8} y={T + 14} textAnchor="end" fontSize="11" fill="var(--color-cyan)" className="signal-sm">{quadrants[1]}</text>
          <text x={L + 8} y={H - B - 8} fontSize="11" fill="var(--color-gold)" className="signal-sm">{quadrants[2]}</text>
          <text x={W - R - 8} y={H - B - 8} textAnchor="end" fontSize="11" fill="var(--color-loss)" className="signal-sm">{quadrants[3]}</text>
        </>
      ) : null}
      {dots.map((d) => (
        <g key={d.key}>
          <circle cx={X(d.x)} cy={Y(d.y)} r={rOf(d)} fill={d.hot ? 'var(--color-win)' : 'var(--color-series-1)'} fillOpacity={d.hot ? 0.55 : 0.35} stroke={d.hot ? 'var(--color-win)' : 'var(--color-series-1)'}>
            <title>{`${d.name} · ${fmtX(d.x)} · ${fmtY(d.y)}`}</title>
          </circle>
          {named.has(d.key) ? <text x={X(d.x) + rOf(d) + 4} y={Y(d.y) + 4} fontSize="11" fill="var(--color-ink)">{d.name}</text> : null}
        </g>
      ))}
    </svg>
  )
}

/** One line per series over the season days; a null breaks the line instead of bridging it. */
const Lines = ({ series, days, fmt }: { series: { key: string; name: string; color: string; values: (number | null)[] }[]; days: number[]; fmt: (v: number) => string }) => {
  const W = 640, H = 240, L = 48, R = 16, T = 12, B = 28
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null))
  if (!all.length || days.length < 2) return null
  const y0 = Math.min(...all), y1 = Math.max(...all), pad = (y1 - y0 || 0.02) * 0.1
  const X = (i: number) => L + (i / (days.length - 1)) * (W - L - R)
  const Y = (v: number) => T + (1 - (v - (y0 - pad)) / (y1 - y0 + 2 * pad)) * (H - T - B)
  const path = (values: (number | null)[]) => values.map((v, i) => (v == null ? null : `${X(i)},${Y(v)}`)).reduce<string[]>((acc, p, i, arr) => (p == null ? acc : (i === 0 || arr[i - 1] == null ? acc.push(`M${p}`) : acc.push(`L${p}`), acc)), []).join(' ')
  const ticks = [0, 0.5, 1].map((f) => y0 - pad + f * (y1 - y0 + 2 * pad))
  const dayTicks = [0, Math.floor((days.length - 1) / 2), days.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full text-ink-muted">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--color-line)" strokeDasharray="3 4" />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" className="font-mono">{fmt(v)}</text>
        </g>
      ))}
      {dayTicks.map((i) => <text key={i} x={X(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="currentColor" className="font-mono">D{days[i]}</text>)}
      {series.map((s) => (
        <path key={s.key} d={path(s.values)} fill="none" stroke={`var(--color-${s.color})`} strokeWidth="2" vectorEffect="non-scaling-stroke"><title>{s.name}</title></path>
      ))}
    </svg>
  )
}

/** The deck's meta share, day by day. `null` while it has under two points. */
const Spark = ({ points }: { points?: TrendPoint[] }) => {
  if (!points || points.length < 2) return null
  const shares = points.map(([, share]) => share)
  const lo = Math.min(...shares), hi = Math.max(...shares)
  const line = shares.map((v, i) => `${(i / (shares.length - 1)) * 100},${24 - ((v - lo) / (hi - lo || 1)) * 22}`).join(' ')
  return (
    <svg aria-hidden viewBox="0 0 100 26" preserveAspectRatio="none" className="h-6 w-full">
      <polyline points={line} fill="none" stroke="var(--color-series-1)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const Growth = ({ value }: { value?: number | null }) =>
  value == null ? (
    <span className="text-ink-muted">—</span>
  ) : (
    <span className={value > 0 ? 'text-win' : value < 0 ? 'text-loss' : 'text-ink-dim'}>
      {value > 0 ? '▲ ' : value < 0 ? '▼ ' : ''}{Math.abs(value * 100).toFixed(1)}
    </span>
  )

const TierMark = ({ tier }: { tier?: StatArchetype['tier'] }) => (tier ? <span className={twMerge('flex-none font-mono text-[11px] font-bold', TIER_COLOR[tier])}>T{tier}</span> : null)

/** A highlight card: label, big figure, the deck, one line of context. */
const Highlight = ({ label, value, name, note, tone }: { label: string; value: string; name?: string; note: string; tone?: 'win' | 'loss' | 'gold' }) => (
  <li className="flex flex-col gap-0.5 border border-line bg-surface-100 p-4">
    <span className="text-ink-muted signal-sm">{label}</span>
    <span className={twMerge('mt-1 font-mono text-xl font-bold tabular-nums', tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : tone === 'gold' ? 'text-gold' : 'text-ink')}>{value}</span>
    {name ? <span className="truncate text-sm font-bold text-ink">{name}</span> : null}
    <span className={NOTE}>{note}</span>
  </li>
)

// ---- the table

type Col = { id: string; label: string; cell: (r: Row) => ReactNode; sort?: (r: Row) => number | string | null | undefined; width?: string }

const RankingTable = ({ rows, cols, mobile, scope, compareHref }: { rows: Row[]; cols: Col[]; mobile: (r: Row) => [string, string]; scope: StatisticsScope; compareHref: (key: string) => string }) => {
  const t = useTranslations('Statistics.ranking')
  const [sort, onSort] = useSort<string>()
  const [expanded, setExpanded] = useState(false)
  const rankOf = new Map(rows.map((r, i) => [r.key, i + 1]))
  const getters = Object.fromEntries(cols.flatMap((c) => (c.sort ? [[c.id, c.sort]] : []))) as Getters<Row, string>
  getters.name = (r) => nameOf(r.a)
  const sorted = sortBy(rows, sort, getters)
  const visible = expanded ? sorted : sorted.slice(0, FOLD)
  const grid = `32px minmax(190px, 1.8fr) ${cols.map((c) => c.width ?? 'minmax(84px, 0.8fr)').join(' ')} 88px`

  return (
    <>
      <div className="max-h-[760px] overflow-auto max-[719px]:hidden">
        <div role="table" aria-label={t('title')} className="min-w-[880px] border border-line">
          <SortHeads
            sticky
            cols={grid}
            labels={['#', t('cols.deck'), ...cols.map((c) => c.label), '']}
            keys={[null, 'name', ...cols.map((c) => (c.sort ? c.id : null)), null]}
            sort={sort}
            onSort={onSort}
            right={(i) => i >= 2 && i < cols.length + 2}
          />
          {visible.map((r) => (
            <div key={r.key} role="row" className={ROW} style={{ gridTemplateColumns: grid }}>
              <span role="cell" className="font-mono text-xs text-ink-muted tabular-nums">{rankOf.get(r.key)}</span>
              <span role="cell" className="flex min-w-0 items-center gap-2">
                <Art card={faceOf(r.a)} size={32} className="size-8" />
                <Link href={deckHref(r.a.archetype, scope)} title={nameOf(r.a)} className="truncate font-bold text-ink hover:text-cyan">{nameOf(r.a)}</Link>
                <TierMark tier={r.a.tier} />
              </span>
              {cols.map((c) => <span key={c.id} role="cell" className={twMerge(NUM, 'text-xs')}>{c.cell(r)}</span>)}
              <span role="cell" className="text-right">
                <Link href={compareHref(r.key)} className="inline-flex items-center gap-1 text-xs text-azure-lift hover:text-ink"><Icon name="plus" size={12} />{t('compare')}</Link>
              </span>
            </div>
          ))}
          {!visible.length ? <p className={twMerge(NOTE, 'px-4 py-3')}>{t('empty')}</p> : null}
        </div>
      </div>

      <ol className="flex flex-col gap-px border border-line bg-line min-[720px]:hidden">
        {visible.map((r) => {
          const [value, label] = mobile(r)
          return (
            <li key={r.key}>
              <Link href={deckHref(r.a.archetype, scope)} className="grid min-h-16 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 bg-surface-100 p-3">
                <span className="font-mono text-xs text-ink-muted tabular-nums">{rankOf.get(r.key)}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-bold text-ink">{nameOf(r.a)}</span>
                    <TierMark tier={r.a.tier} />
                  </span>
                  <span className="text-xs text-ink-muted">{t('rowSub', { rate: pct(r.a.winRate), games: num(r.a.games) })}</span>
                </span>
                <span className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-sm font-bold text-ink tabular-nums">{value}</span>
                  <span className="text-ink-muted signal-sm">{label}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>

      {sorted.length > FOLD ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 cursor-pointer text-[13px] text-azure-lift transition-colors hover:text-ink">
          {expanded ? t('showTop', { count: FOLD }) : t('showAll', { count: sorted.length })}
        </button>
      ) : null}
    </>
  )
}

// ---- the modes

type ModeView = { highlights: ReactNode; chart: ReactNode; rows: Row[]; cols: Col[]; mobile: (r: Row) => [string, string]; note: string }

const Mode = ({ mode, rows, data, days, scope }: { mode: RankingMode; rows: Row[]; data: Statistics; days: number; scope: StatisticsScope }) => {
  const t = useTranslations('Statistics.ranking')
  const [yAxis, setYAxis] = useState<'winRate' | 'adjusted'>('winRate')
  const [minGames, setMinGames] = useState<(typeof MIN_GAMES)[number]>(0)
  const [view, setView] = useState<'popularity' | 'performance'>('popularity')
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const serverOrder = (keys: number[][] | undefined, fallback: (a: Row, b: Row) => number) => {
    if (!keys) return [...rows].sort(fallback)
    const left = new Map(byKey)
    const out = keys.flatMap((k) => { const r = left.get(archKey(k)); left.delete(archKey(k)); return r ? [r] : [] })
    return [...out, ...left.values()]
  }
  const compareHref = (key: string) => `${statisticsHref(scope)}&section=compare&decks=${key}`
  const seasonDays = data.trends[0]?.points.map((p) => p[0]) ?? []
  const colShare: Col = { id: 'share', label: t('cols.share'), cell: (r) => pct(r.a.metaShare), sort: (r) => r.a.metaShare }
  const colWinRate: Col = { id: 'winRate', label: t('cols.winRate'), cell: (r) => <><span className="font-bold text-ink">{pct(r.a.winRate)}</span>{r.a.ci ? <span className="ml-1 text-[11px] text-ink-muted">±{(r.a.ci.margin * 100).toFixed(1)}</span> : null}</>, sort: (r) => r.a.winRate }
  /** The adjusted win rate (shrunk toward the ladder, widened by its noise); the Wilson lower bound from an older server. */
  const colAdjusted: Col = { id: 'adjusted', label: t('cols.adjusted'), cell: (r) => pct(strengthOf(r.a)), sort: (r) => strengthOf(r.a) }
  const colGames: Col = { id: 'games', label: t('cols.games'), cell: (r) => num(r.a.games), sort: (r) => r.a.games }
  const colGrowth: Col = { id: 'growth', label: t('cols.growth', { days }), cell: (r) => <span className="font-mono"><Growth value={r.a.growth} /></span>, sort: (r) => r.a.growth }
  const colTrend: Col = { id: 'trend', label: t('cols.trend'), cell: (r) => <Spark points={r.points} />, width: 'minmax(96px, 1fr)' }

  let v: ModeView
  if (mode === 'mostPlayed') {
    const ordered = serverOrder(data.rankings?.mostPlayed, (a, b) => b.a.games - a.a.games)
    const [lead, second] = ordered
    const top5 = ordered.slice(0, 5).reduce((s, r) => s + r.a.metaShare, 0)
    const gain = [...rows].sort((a, b) => (b.a.growth ?? -1) - (a.a.growth ?? -1))[0]
    const loss = [...rows].sort((a, b) => (a.a.growth ?? 1) - (b.a.growth ?? 1))[0]
    v = {
      highlights: (
        <>
          {lead ? <Highlight label={t('mp.leader')} value={pct(lead.a.metaShare)} name={nameOf(lead.a)} note={second ? t('mp.leaderNote', { ratio: (lead.a.metaShare / (second.a.metaShare || 1)).toFixed(1), name: nameOf(second.a) }) : ''} /> : null}
          <Highlight label={t('mp.top5')} value={pct(top5)} note={t('mp.top5Note')} tone={top5 > 0.4 ? 'gold' : undefined} />
          {gain?.a.growth != null && gain.a.growth > 0 ? <Highlight label={t('mp.gaining')} value={pp(gain.a.growth)} name={nameOf(gain.a)} note={t('mp.ppNote', { days })} tone="win" /> : null}
          {loss?.a.growth != null && loss.a.growth < 0 ? <Highlight label={t('mp.losing')} value={pp(loss.a.growth)} name={nameOf(loss.a)} note={t('mp.ppNote', { days })} tone="loss" /> : null}
        </>
      ),
      chart: (
        <ol className="flex flex-col gap-2">
          {ordered.slice(0, 8).map((r, i) => (
            <li key={r.key} className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-2 min-[720px]:grid-cols-[24px_minmax(120px,0.6fr)_minmax(0,2fr)_72px]">
              <Art card={faceOf(r.a)} size={24} className="size-6" />
              <Link href={deckHref(r.a.archetype, scope)} className="truncate text-sm font-bold text-ink hover:text-cyan">{nameOf(r.a)}</Link>
              <span className="max-[719px]:col-span-2"><Bar value={r.a.metaShare} max={ordered[0]!.a.metaShare} color={SERIES[i % SERIES.length]} label={pct(r.a.metaShare)} /></span>
              <span className="text-right font-mono text-xs max-[719px]:hidden"><Growth value={r.a.growth} /></span>
            </li>
          ))}
        </ol>
      ),
      rows: ordered,
      cols: [colShare, colGrowth, { id: 'winRate2', label: t('cols.winRate'), cell: (r) => pct(r.a.winRate), sort: (r) => r.a.winRate }, colTrend],
      mobile: (r) => [pct(r.a.metaShare), t('cols.share')],
      note: t('note.mostPlayed', { days }),
    }
  } else if (mode === 'highestWinRate') {
    const pool = rows.filter((r) => r.a.games >= minGames && r.a.winRate != null)
    const ordered = serverOrder(data.rankings?.highestWinRate, (a, b) => (strengthOf(b.a) ?? -1) - (strengthOf(a.a) ?? -1)).filter((r) => r.a.games >= minGames)
    const hiWr = [...pool].sort((a, b) => (b.a.winRate ?? 0) - (a.a.winRate ?? 0))[0]
    const hiAdjusted = [...pool].sort((a, b) => (strengthOf(b.a) ?? 0) - (strengthOf(a.a) ?? 0))[0]
    const most = [...pool].sort((a, b) => b.a.games - a.a.games)[0]
    const yOf = (r: Row) => (yAxis === 'adjusted' ? strengthOf(r.a) : r.a.winRate) ?? 0
    v = {
      highlights: (
        <>
          {hiWr ? <Highlight label={t('wr.highest')} value={pct(hiWr.a.winRate)} name={nameOf(hiWr.a)} note={t('wr.gamesNote', { games: num(hiWr.a.games) })} tone="win" /> : null}
          {hiAdjusted ? <Highlight label={t('wr.adjusted')} value={pct(strengthOf(hiAdjusted.a))} name={nameOf(hiAdjusted.a)} note={t('wr.adjustedNote')} /> : null}
          {most ? <Highlight label={t('wr.evidence')} value={num(most.a.games)} name={nameOf(most.a)} note={t('wr.evidenceNote', { rate: pct(most.a.winRate) })} /> : null}
        </>
      ),
      chart: (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 text-ink-muted signal-sm">{t('wr.yAxis')}<Segmented size="sm" label={t('wr.yAxis')} value={yAxis} onChange={setYAxis} options={[{ value: 'winRate', label: t('cols.winRate') }, { value: 'adjusted', label: t('cols.adjusted') }]} /></span>
            <span className="flex items-center gap-2 text-ink-muted signal-sm">{t('wr.minGames')}<Segmented size="sm" label={t('wr.minGames')} value={minGames} onChange={setMinGames} options={MIN_GAMES.map((g) => ({ value: g, label: g ? num(g) : t('wr.any') }))} /></span>
          </div>
          <Scatter dots={pool.map((r) => ({ key: r.key, name: nameOf(r.a), x: r.a.games, y: yOf(r), size: r.a.metaShare, hot: r === hiAdjusted }))} xLog guides={{ y: 0.5 }} fmtX={(x) => (x >= 1000 ? `${(x / 1000).toFixed(0)}k` : num(Math.round(x)))} fmtY={(y) => `${(y * 100).toFixed(0)}%`} />
          <p className={twMerge(NOTE, 'mt-1')}>{t('wr.chartNote')}</p>
        </>
      ),
      rows: ordered,
      cols: [colWinRate, colAdjusted, colGames, { id: 'conf', label: t('wr.confidence'), cell: (r) => (r.a.ci ? <span className={r.a.ci.margin > 0.03 ? 'text-gold' : 'text-ink-dim'}>{r.a.ci.margin > 0.03 ? t('wr.loose') : t('wr.tight')}</span> : '—'), sort: (r) => (r.a.ci ? -r.a.ci.margin : null) }],
      mobile: (r) => [pct(strengthOf(r.a)), t('cols.adjusted')],
      note: t('note.highestWinRate'),
    }
  } else if (mode === 'rising') {
    const ordered = view === 'popularity'
      ? serverOrder(data.rankings?.rising, (a, b) => (b.a.growth ?? -1) - (a.a.growth ?? -1))
      : [...rows].filter((r) => r.wrChange != null).sort((a, b) => b.wrChange! - a.wrChange!)
    const value = (r: Row) => (view === 'popularity' ? r.a.growth : r.wrChange) ?? null
    const [lead, also] = ordered.filter((r) => (value(r) ?? 0) > 0)
    const cooling = [...ordered].reverse().find((r) => (value(r) ?? 0) < 0)
    const top = ordered.slice(0, 5)
    v = {
      highlights: (
        <>
          {lead ? <Highlight label={t('ri.leader')} value={pp(value(lead)!)} name={nameOf(lead.a)} note={t(`ri.unit.${view}`, { days })} tone="win" /> : null}
          {also ? <Highlight label={t('ri.also')} value={pp(value(also)!)} name={nameOf(also.a)} note={t(`ri.unit.${view}`, { days })} tone="win" /> : null}
          {cooling ? <Highlight label={t('ri.cooling')} value={pp(value(cooling)!)} name={nameOf(cooling.a)} note={t(`ri.unit.${view}`, { days })} tone="loss" /> : null}
        </>
      ),
      chart: (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented size="sm" label={t('ri.view')} value={view} onChange={setView} options={[{ value: 'popularity', label: t('ri.popularity') }, { value: 'performance', label: t('ri.performance') }]} />
          </div>
          <Lines days={seasonDays} fmt={(y) => `${(y * 100).toFixed(view === 'popularity' ? 1 : 0)}%`} series={top.map((r, i) => ({ key: r.key, name: nameOf(r.a), color: SERIES[i % SERIES.length]!, values: (r.points ?? []).map((p) => (view === 'popularity' ? p[1] : p[2])) }))} />
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-dim">
            {top.map((r, i) => <li key={r.key} className="flex items-center gap-1.5"><span className="size-2" style={{ background: `var(--color-${SERIES[i % SERIES.length]})` }} />{nameOf(r.a)}</li>)}
          </ul>
        </>
      ),
      rows: ordered,
      cols: [
        view === 'popularity' ? colGrowth : { id: 'wrChange', label: t('ri.wrChange', { days }), cell: (r) => <span className="font-mono"><Growth value={r.wrChange} /></span>, sort: (r) => r.wrChange },
        { id: 'prior', label: t('ri.prior', { days }), cell: (r) => <span className="font-mono"><Growth value={r.prior} /></span>, sort: (r) => r.prior },
        { id: 'kind', label: t('ri.kind'), cell: (r) => (r.kind ? <Chip tone={KIND_TONE[r.kind]}>{t(`ri.kinds.${r.kind}`)}</Chip> : '—'), width: 'minmax(120px, 1fr)' },
        colShare,
        colTrend,
      ],
      mobile: (r) => [value(r) == null ? '—' : pp(value(r)!), t(`ri.${view}`)],
      note: t('note.rising', { days }),
    }
  } else if (mode === 'sleeper') {
    const med = median(rows.flatMap((r) => { const s = strengthOf(r.a); return s == null ? [] : [s] }))
    const isGem = (r: Row) => r.a.metaShare < SLEEPER.share && r.a.games >= SLEEPER.games && (strengthOf(r.a) ?? 0) >= med
    const gems = rows.filter(isGem).sort((a, b) => (strengthOf(b.a) ?? 0) - (strengthOf(a.a) ?? 0))
    const [top] = gems
    const medWr = median(rows.flatMap((r) => (r.a.winRate == null ? [] : [r.a.winRate])))
    v = {
      highlights: (
        <>
          {top ? <Highlight label={t('sl.gem')} value={pct(top.a.winRate)} name={nameOf(top.a)} note={t('sl.gemNote', { share: pct(top.a.metaShare), games: num(top.a.games) })} tone="win" /> : null}
          <Highlight label={t('sl.found')} value={String(gems.length)} note={t('sl.foundNote', { count: rows.length })} />
          <Highlight label={t('sl.rule')} value={`< ${pct(SLEEPER.share)}`} note={t('sl.ruleNote', { games: num(SLEEPER.games), median: pct(med) })} />
        </>
      ),
      chart: (
        <>
          <Scatter
            dots={rows.filter((r) => r.a.winRate != null).map((r) => ({ key: r.key, name: nameOf(r.a), x: r.a.metaShare, y: r.a.winRate!, size: r.a.games, hot: isGem(r) }))}
            guides={{ x: SLEEPER.share, y: medWr }}
            quadrants={[t('sl.q.gems'), t('sl.q.leaders'), t('sl.q.niche'), t('sl.q.struggling')]}
            fmtX={(x) => `${(x * 100).toFixed(1)}%`}
            fmtY={(y) => `${(y * 100).toFixed(0)}%`}
            labels={8}
          />
          <p className={twMerge(NOTE, 'mt-1')}>{t('sl.chartNote', { share: pct(SLEEPER.share) })}</p>
        </>
      ),
      rows: gems,
      cols: [colWinRate, colAdjusted, colShare, colGames],
      mobile: (r) => [pct(strengthOf(r.a)), t('cols.adjusted')],
      note: t('note.sleeper', { share: pct(SLEEPER.share), games: num(SLEEPER.games) }),
    }
  } else {
    // φ from the server: how far past pure chance the daily win rate moves (the raw daily SD counts the chance too, so
    // a small deck looked unstable). An older server has no φ: the SD stays as the fallback.
    const noise = (r: Row) => r.a.overdispersion ?? null
    const hasNoise = rows.some((r) => noise(r) != null)
    const vary = (r: Row) => (hasNoise ? `×${(noise(r) ?? 1).toFixed(1)}` : `±${(r.stab!.sd * 100).toFixed(1)}`)
    const stable = rows
      .filter((r) => r.stab && r.stab.mean >= 0.5)
      .sort((a, b) => (hasNoise ? (noise(a) ?? 9) - (noise(b) ?? 9) || (strengthOf(b.a) ?? 0) - (strengthOf(a.a) ?? 0) : a.stab!.sd - b.stab!.sd))
    const [top] = stable
    const floor = [...stable].sort((a, b) => b.stab!.floor - a.stab!.floor)[0]
    const swing = (r: Row) => { const { first, second } = r.a.turnOrder; return first.winRate != null && second.winRate != null ? Math.abs(first.winRate - second.winRate) : null }
    const balanced = [...rows].filter((r) => swing(r) != null && (r.a.winRate ?? 0) >= 0.5).sort((a, b) => swing(a)! - swing(b)!)[0]
    v = {
      highlights: (
        <>
          {top ? <Highlight label={t('co.stable')} value={pct(top.stab!.mean)} name={nameOf(top.a)} note={hasNoise ? t('co.noiseNote', { phi: (noise(top) ?? 1).toFixed(1) }) : t('co.stableNote', { sd: (top.stab!.sd * 100).toFixed(1) })} tone="win" /> : null}
          {floor ? <Highlight label={t('co.floor')} value={pct(floor.stab!.floor)} name={nameOf(floor.a)} note={t('co.floorNote')} /> : null}
          {balanced ? <Highlight label={t('co.balance')} value={pp(swing(balanced)!, false)} name={nameOf(balanced.a)} note={t('co.balanceNote')} /> : null}
        </>
      ),
      chart: (
        <>
          <ol className="flex flex-col gap-2.5">
            {stable.slice(0, 8).map((r) => {
              const d = daily(r.points).map((x) => x.wr).sort((a, b) => a - b)
              const p80 = d[Math.floor((d.length - 1) * 0.8)]!
              return (
                <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 min-[720px]:grid-cols-[minmax(120px,0.6fr)_minmax(0,2fr)_80px]">
                  <Link href={deckHref(r.a.archetype, scope)} className="truncate text-sm font-bold text-ink hover:text-cyan">{nameOf(r.a)}</Link>
                  <span className="font-mono text-xs text-ink-muted tabular-nums min-[720px]:order-3 min-[720px]:text-right">{vary(r)}</span>
                  <span className="relative h-3 bg-surface-200 max-[719px]:col-span-2" aria-hidden>
                    <span className="absolute inset-y-0 w-px bg-line-strong" style={{ left: at(0.5) }} />
                    <span className="absolute top-1 h-1 bg-series-1" style={{ left: at(r.stab!.floor), right: `calc(100% - ${at(p80)})` }} />
                    <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: at(r.stab!.mean) }} />
                  </span>
                </li>
              )
            })}
          </ol>
          <p className={twMerge(NOTE, 'mt-2')}>{t('co.chartNote')}</p>
        </>
      ),
      rows: stable,
      cols: [
        { id: 'typical', label: t('co.typical'), cell: (r) => <span className="font-bold text-ink">{pct(r.stab!.mean)}</span>, sort: (r) => r.stab!.mean },
        { id: 'sd', label: t('co.variation'), cell: vary, sort: (r) => (hasNoise ? -(noise(r) ?? 9) : -r.stab!.sd) },
        { id: 'floor', label: t('co.floorCol'), cell: (r) => pct(r.stab!.floor), sort: (r) => r.stab!.floor },
        { id: 'worst', label: t('cols.worst'), cell: (r) => pct(r.a.consistencyScore), sort: (r) => r.a.consistencyScore },
        { id: 'days', label: t('co.days'), cell: (r) => String(r.stab!.days), sort: (r) => r.stab!.days },
      ],
      mobile: (r) => [vary(r), t('co.variation')],
      note: hasNoise ? t('note.consistentNoise', { days: MIN_DAYS }) : t('note.consistent', { days: MIN_DAYS }),
    }
  }

  return (
    <>
      <p className="mb-4 text-ink-dim body">{t(`question.${mode}`)}</p>
      <ul className="mb-6 grid gap-3 min-[720px]:grid-cols-3">{v.highlights}</ul>
      <div className="mb-6 border border-line bg-surface-100 p-4">{v.chart}</div>
      <RankingTable rows={v.rows} cols={v.cols} mobile={v.mobile} scope={scope} compareHref={compareHref} />
      <p className={twMerge(NOTE, 'mt-3')}>{v.note}</p>
    </>
  )
}

export const DeckRanking = ({ data, scope }: DeckRankingProps) => {
  const t = useTranslations('Statistics.ranking')
  const router = useRouter()
  const [mode, setMode] = useState<RankingMode>('mostPlayed')
  const [searchFailed, setSearchFailed] = useState(false)
  const code = data.season.code
  const days = growthDays(data.syncedDays.count)
  const pointsOf = new Map(data.trends.map((d) => [archKey(d.archetype), d.points]))
  const rows: Row[] = data.archetypes.map((a) => {
    const key = archKey(a.archetype), points = pointsOf.get(key)
    const prior = windowChange(points, days, 1, days)
    return { a, key, points, stab: stabilityOf(points), prior, wrChange: windowChange(points, days, 2), kind: kindOf(a.growth, prior) }
  })

  const search = useCallback(
    async (text: string, signal: AbortSignal): Promise<LookupOption[]> => {
      const q = text.toLowerCase()
      try {
        const index = await getArchetypeIndex(code, 'main', signal)
        setSearchFailed(false)
        return index
          .filter((e) => nameOf(e).toLowerCase().includes(q))
          .slice(0, 20)
          .map((e) => ({ key: archKey(e.archetype), label: nameOf(e), meta: t('searchMeta', { games: num(e.games) }) }))
      } catch {
        if (!signal.aborted) setSearchFailed(true)
        return []
      }
    },
    [code, t],
  )

  return (
    <Panel title={t('title')} meta={t('meta', { count: data.archetypes.length })}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Lookup label={t('search')} placeholder={t('search')} search={search} onPick={({ key }) => router.push(deckHref(String(key).split('-').map(Number), scope))} className="w-full max-w-md" />
        <span className="text-ink-muted signal-sm">
          {t('counts', { decks: num(data.totals.archetypes) })}
          {data.views ? ` · ${t('generalCount', { count: num(data.views.generalCount) })}` : ''}
        </span>
      </div>
      {searchFailed ? <p role="status" className={twMerge(NOTE, 'mb-3')}>{t('searchDown')}</p> : null}
      <TabBar tabs={RANKING_MODES.map((id) => ({ id, label: t(`tabs.${id}`) }))} active={mode} onSelect={setMode} label={t('tabsLabel')} idPrefix="deck-ranking" fit className="mb-4" />
      {/* Keyed by tab: each mode starts with its own controls, column sort and fold cleared. */}
      <Mode key={mode} mode={mode} rows={rows} data={data} days={days} scope={scope} />
      <p className="mt-1 text-ink-muted signal-sm">{t('legend', { days })}</p>
    </Panel>
  )
}
