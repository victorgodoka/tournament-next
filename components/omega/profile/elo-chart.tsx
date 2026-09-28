'use client'

import { useId, useMemo, useState } from 'react'
import type { EloPoint } from '@utils/types'
import { LineChart } from '@ui/chart'
import { ModeTabs } from '@ui/mode-tabs'
import { MICRO_LABEL } from './accent'
import { formatNumber } from './labels'

const RANGES = [
  { id: '7', label: '7 days' },
  { id: '14', label: '14 days' },
  { id: '30', label: '30 days' },
  { id: '0', label: 'Season' },
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
const pointsOf = (history: EloPoint[], live: number, range: number): Point[] => {
  const all: Point[] = history.map((p) => ({ day: p.day, label: short(p.day), elo: p.elo }))
  const last = all.at(-1)
  if (!last || last.elo !== live) all.push({ day: last?.day ?? '', label: 'Now', elo: live, live: true })
  if (!range || !last) return all
  const cutoff = dayMs(last.day) - (range - 1) * DAY
  return all.filter((p) => p.live || dayMs(p.day) >= cutoff)
}

type EloChartProps = {
  history: EloPoint[]
  /** The season's live `elo`. */
  live: number
  season: string
}

/** Rating per day over the open season, with a range picker. The table under it carries the same numbers. */
export const EloChart = ({ history, live, season }: EloChartProps) => {
  const [range, setRange] = useState<Range>('14')
  const tableId = useId()
  const points = useMemo(() => pointsOf(history, live, Number(range)), [history, live, range])
  const first = points[0]
  const delta = first ? live - first.elo : 0

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className={MICRO_LABEL}>Elo per day · {season}</p>
        {first && points.length > 1 ? (
          <p className="text-ink-dim mono-data">
            <span className={delta > 0 ? 'text-win' : delta < 0 ? 'text-loss' : undefined}>{delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : ''}{formatNumber(delta)}</span> since {first.label}
          </p>
        ) : null}
        <ModeTabs label="Range" items={RANGES} value={range} onChange={setRange} className="ml-auto" />
      </div>

      {points.length > 1 ? (
        <div aria-describedby={tableId}>
          <LineChart
            labels={points.map((p) => p.label)}
            series={[{ name: 'Elo', data: points.map((p) => p.elo) }]}
            format={formatNumber}
            directLabels={false}
            title={`Elo from ${formatNumber(first!.elo)} on ${first!.label} to ${formatNumber(live)} now`}
            className="[&_figcaption]:sr-only"
          />
        </div>
      ) : (
        <p className="text-ink-muted body-sm">
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
