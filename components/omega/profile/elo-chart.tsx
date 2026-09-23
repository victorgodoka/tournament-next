'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CategoryScale, Chart, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js'
import { twMerge } from 'tailwind-merge'
import type { EloPoint } from '@utils/types'
import { MICRO_LABEL } from './accent'
import { formatNumber } from './labels'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip)

const RANGES = [
  { id: 7, label: '7 days' },
  { id: 14, label: '14 days' },
  { id: 30, label: '30 days' },
  { id: 0, label: 'Season' },
] as const
type Range = (typeof RANGES)[number]['id']

const DAY = 86_400_000
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`)
const short = (day: string) => new Date(dayMs(day)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })

type Point = { day: string; label: string; elo: number; live?: boolean }

/**
 * Daily points of the open season, plus today's live rating as the last one ("Now"): the history's
 * last point is the last sync, not the current value. Days with no sync have no point; never filled.
 */
const pointsOf = (history: EloPoint[], live: number, range: Range): Point[] => {
  const all: Point[] = history.map((p) => ({ day: p.day, label: short(p.day), elo: p.elo }))
  const last = all.at(-1)
  if (!last || last.elo !== live) all.push({ day: last?.day ?? '', label: 'Now', elo: live, live: true })
  if (!range || !last) return all
  const cutoff = dayMs(last.day) - (range - 1) * DAY
  return all.filter((p) => p.live || dayMs(p.day) >= cutoff)
}

const css = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim()

type EloChartProps = {
  history: EloPoint[]
  /** The season's live `elo`. */
  live: number
  season: string
}

/** Rating per day over the open season, with a range picker. The table under it carries the same numbers. */
export const EloChart = ({ history, live, season }: EloChartProps) => {
  const [range, setRange] = useState<Range>(14)
  const canvas = useRef<HTMLCanvasElement>(null)
  const tableId = useId()
  const points = useMemo(() => pointsOf(history, live, range), [history, live, range])
  const first = points[0]
  const delta = first ? live - first.elo : 0

  useEffect(() => {
    const el = canvas.current
    if (!el || points.length < 2) return
    const gold = css(el, '--color-gold')
    const line = css(el, '--color-line')
    const muted = css(el, '--color-ink-muted')
    const font = { family: getComputedStyle(el).fontFamily, size: 11 }
    const chart = new Chart(el, {
      type: 'line',
      data: {
        labels: points.map((p) => p.label),
        datasets: [{
          data: points.map((p) => p.elo),
          borderColor: gold,
          borderWidth: 2,
          pointRadius: points.length > 20 ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: gold,
          pointBorderColor: css(el, '--color-surface-000'),
          pointBorderWidth: 2,
          tension: 0,
        }],
      },
      options: {
        animation: false,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, border: { color: line }, ticks: { color: muted, font, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: { grid: { color: line }, border: { display: false }, ticks: { color: muted, font, maxTicksLimit: 5, callback: (v) => formatNumber(Number(v)) }, grace: '10%' },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: css(el, '--color-surface-100'),
            borderColor: css(el, '--color-line-strong'),
            borderWidth: 1,
            cornerRadius: 0,
            titleColor: muted,
            bodyColor: css(el, '--color-ink'),
            titleFont: font,
            bodyFont: { ...font, size: 13 },
            callbacks: { label: (item) => `${formatNumber(item.parsed.y ?? 0)} Elo` },
          },
        },
      },
    })
    return () => chart.destroy()
  }, [points])

  return (
    <div className="mt-6 border border-line p-[clamp(12px,1.6vw,18px)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className={MICRO_LABEL}>Elo per day · {season}</p>
        {first && points.length > 1 ? (
          <p className="text-ink-dim mono-data">
            <span className={delta > 0 ? 'text-win' : delta < 0 ? 'text-loss' : undefined}>{delta > 0 ? '+' : ''}{formatNumber(delta)}</span> since {first.label}
          </p>
        ) : null}
        <div role="group" aria-label="Range" className="ml-auto flex border border-line">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={range === r.id}
              onClick={() => setRange(r.id)}
              className={twMerge('min-h-9 border-r border-line px-3 signal-chip last:border-r-0', range === r.id ? 'bg-gold text-gold-on' : 'text-ink-dim hover:bg-surface-300 hover:text-ink')}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {points.length > 1 ? (
        <div className="relative mt-3 h-[clamp(180px,24vw,240px)] font-mono">
          <canvas
            ref={canvas}
            role="img"
            aria-label={`Elo from ${formatNumber(first!.elo)} on ${first!.label} to ${formatNumber(live)} now`}
            aria-describedby={tableId}
          />
        </div>
      ) : (
        <p className="mt-3 text-ink-muted body-sm">
          {history.length ? 'Only one day recorded so far.' : 'No daily rating yet.'} The ladder syncs once a day; the line appears after the second day.
        </p>
      )}

      <details className="mt-2">
        <summary className="inline-flex min-h-9 cursor-pointer items-center text-ink-muted signal-sm hover:text-ink">Show as table</summary>
        <table id={tableId} className="mt-2 w-full max-w-sm border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-ink-muted signal-sm">
              <th scope="col" className="py-1.5 font-normal">Day</th>
              <th scope="col" className="py-1.5 text-right font-normal">Elo</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={`${p.day}-${p.label}`} className="border-b border-line mono-data">
                <td className="py-1 text-ink-dim">{p.label}</td>
                <td className="py-1 text-right text-ink tabular-nums">{formatNumber(p.elo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
