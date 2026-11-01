'use client'

import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

/** Series colors, fixed order, never cycled and never text. */
const SERIES = ['series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6']
const color = (token: string) => `var(--color-${token})`

const FIGURE = 'relative m-0 border border-line bg-surface-100 p-5'

const Caption = ({ title, subtitle }: { title?: React.ReactNode; subtitle?: React.ReactNode }) =>
  title ? (
    <figcaption className="mb-4 flex items-baseline gap-3 text-ink display-3">
      {title}
      {subtitle ? <small className="ml-auto text-ink-muted signal-sm">{subtitle}</small> : null}
    </figcaption>
  ) : null

/** Round ticks covering [min, max] in about `n` steps. */
const niceTicks = (min: number, max: number, n: number) => {
  const span = max - min || 1
  let step = 10 ** Math.floor(Math.log10(span / n))
  const err = span / n / step
  step *= err >= 7.5 ? 10 : err >= 3 ? 5 : err >= 1.5 ? 2 : 1
  const ticks: number[] = []
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

const useWidth = (initial: number) => {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const w = Math.round(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/** A `null` point is a gap: the line breaks there instead of bridging it or dropping to zero. */
export type Series = { name: string; data: (number | null)[]; /** Color token name; defaults to series-N. */ color?: string }

type LineChartProps = {
  labels: string[]
  series: Series[]
  title?: React.ReactNode
  subtitle?: React.ReactNode
  height?: number
  format?: (v: number) => string
  /** Names up to four series at their last point. */
  directLabels?: boolean
  /** 12% wash under the first series. */
  area?: boolean
  className?: string
}

/**
 * SVG line chart for change over time. chart-grid rules, mono axes, one y-axis; a legend from two
 * series up; hovering shows a crosshair and tooltip.
 */
export const LineChart = ({ labels, series, title, subtitle, height = 220, format = String, directLabels = true, area = true, className }: LineChartProps) => {
  const [ref, W] = useWidth(640)
  const [hover, setHover] = useState<number | null>(null)
  const H = height, L = 44, R = 12, T = 24, B = 28
  const all = series.flatMap((s) => s.data.filter((v): v is number => v != null))
  const ticks = niceTicks(Math.min(...all), Math.max(...all), 4)
  const y0 = ticks[0] ?? 0, y1 = ticks.at(-1) ?? 1, n = labels.length
  const x = (i: number) => L + (W - L - R) * (n <= 1 ? 0.5 : i / (n - 1))
  const y = (v: number) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0 || 1))
  const col = (s: Series, i: number) => color(s.color ?? SERIES[i % SERIES.length] ?? 'series-1')
  const every = Math.max(1, Math.ceil(n / 8))
  const axis = 'fill-ink-muted font-mono text-[10px] tracking-[0.08em]'

  return (
    <figure className={twMerge(FIGURE, className)}>
      <Caption title={title} subtitle={subtitle} />
      <div ref={ref} className="relative">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={typeof title === 'string' ? title : 'Line chart'} className="block max-w-full overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-chart-grid" />
              <text x={L - 10} y={y(t) + 3} textAnchor="end" className={axis}>{format(t)}</text>
            </g>
          ))}
          {labels.map((label, i) =>
            i % every === 0 || i === n - 1 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className={axis}>{label}</text>
            ) : null,
          )}
          {hover != null ? <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} strokeDasharray="2 3" className="stroke-line-strong" /> : null}
          {series.map((s, si) => {
            // A point after a gap starts a new segment.
            const d = s.data.map((v, i) => (v == null ? '' : `${i && s.data[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)).filter(Boolean).join(' ')
            const last = s.data.findLastIndex((v) => v != null)
            const at = (i: number) => y(s.data[i] ?? 0)
            return (
              <g key={s.name}>
                {si === 0 && area ? (
                  <path d={`${d} L${x(n - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z`} style={{ fill: col(s, si) }} opacity={0.12} />
                ) : null}
                <path d={d} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: col(s, si) }} />
                {last >= 0 ? <circle cx={x(last)} cy={at(last)} r={4.5} strokeWidth={2} className="stroke-surface-100" style={{ fill: col(s, si) }} /> : null}
                {last >= 0 && series.length <= 4 && directLabels ? (
                  <text x={x(last) - 8} y={at(last) - 10} textAnchor="end" className="fill-ink-dim font-sans text-xs font-bold">{s.name}</text>
                ) : null}
                {hover != null && s.data[hover] != null ? <circle cx={x(hover)} cy={at(hover)} r={5} strokeWidth={2} className="stroke-surface-100" style={{ fill: col(s, si) }} /> : null}
              </g>
            )
          })}
          {labels.map((_, i) => {
            const w = (W - L - R) / Math.max(1, n - 1)
            return <rect key={i} x={x(i) - w / 2} y={T} width={w} height={H - T - B} fill="transparent" className="cursor-crosshair" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          })}
        </svg>
        {hover != null ? (
          <div
            style={{ left: `${(x(hover) / W) * 100}%`, top: `${(Math.min(...series.map((s) => y(s.data[hover] ?? 0))) / H) * 100}%` }}
            className="pointer-events-none absolute z-2 -translate-x-1/2 -translate-y-[calc(100%+12px)] border border-line-strong bg-surface-200 px-2.5 py-2 font-sans text-xs leading-4.5 font-medium whitespace-nowrap text-ink shadow-lift"
          >
            <div className="text-ink-muted signal-sm">{labels[hover]}</div>
            {series.map((s, si) => (
              <div key={s.name}>
                <i className="mr-1.5 inline-block size-2" style={{ background: col(s, si) }} />
                {s.name} <b className="tabular-nums">{s.data[hover] == null ? '—' : format(s.data[hover])}</b>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {series.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-ink-dim signal-sm">
          {series.map((s, si) => (
            <span key={s.name}>
              <i className="mr-2 inline-block h-0.5 w-3 align-[3px]" style={{ background: col(s, si) }} />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
    </figure>
  )
}

type BarListProps = {
  /** Sorted largest first. */
  items: Array<{ label: string; value: number; color?: string }>
  title?: React.ReactNode
  subtitle?: React.ReactNode
  max?: number
  /** Color token name; one series, `series-1` by default. */
  color?: string
  format?: (v: number) => React.ReactNode
  className?: string
}

/** Horizontal 8px bars for ranked values: archetype share, card usage, win rate by deck. */
export const BarList = ({ items, title, subtitle, max = Math.max(...items.map((i) => i.value)), color: tone = 'series-1', format = (v) => v, className }: BarListProps) => (
  <figure className={twMerge(FIGURE, className)}>
    <Caption title={title} subtitle={subtitle} />
    <div role="list" className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label} role="listitem" title={`${item.label}: ${format(item.value)}`} className="group grid grid-cols-[124px_1fr_56px] items-center gap-3 text-[13px]">
          <span className="truncate font-semibold text-ink-dim group-hover:text-ink">{item.label}</span>
          <span className="h-2 bg-surface-200">
            <span className="block h-full rounded-r-xs" style={{ width: `${(item.value / (max || 1)) * 100}%`, background: color(item.color ?? tone) }} />
          </span>
          <span className="text-right font-mono text-xs leading-none text-ink tabular-nums">{format(item.value)}</span>
        </div>
      ))}
    </div>
  </figure>
)

type WinRateRingProps = { wins: number; losses: number; draws?: number; /** Default 132; below 120 the record line drops. */ size?: number }

/** Win, loss and draw arcs over a surface-300 track, the rate in Anton at the center, W–L–D under it. */
export const WinRateRing = ({ wins, losses, draws = 0, size = 132 }: WinRateRingProps) => {
  const sw = 8, r = (size - sw) / 2, c = 2 * Math.PI * r, gap = 3
  const total = wins + losses + draws || 1
  const pct = Math.round((wins / total) * 1000) / 10
  let offset = 0
  const arcs = (
    [['win', wins], ['loss', losses], ['draw', draws]] as const
  ).filter(([, v]) => v > 0).map(([key, v]) => {
    const len = (v / total) * c, visible = Math.max(0, len - gap)
    const arc = <circle key={key} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} stroke={color(key)} strokeDasharray={`${visible} ${c - visible}`} strokeDashoffset={-offset} />
    offset += len
    return arc
  })

  return (
    <div role="img" aria-label={`Win rate ${pct}% — ${wins} wins, ${losses} losses, ${draws} draws`} className="relative inline-grid place-items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} className="stroke-surface-300" />
        {arcs}
      </svg>
      <div className="absolute text-center">
        <span className="block font-display leading-none tabular-nums" style={{ fontSize: Math.round(size * 0.23) }}>{pct}%</span>
        {size >= 120 ? <span className="mt-1 block font-mono text-[10px] leading-3 tracking-[0.12em] text-ink-muted">{wins}W {losses}L {draws}D</span> : null}
      </div>
    </div>
  )
}
