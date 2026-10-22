'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@iconify/react'
import { Panel } from '@ui/panel'
import { LineChart } from '@ui/chart'
import { pct, nameOf, NOTE } from '../DeepDive'
import type { MetaEvent, Statistics } from '@utils/statistics'
import { archKey } from '@utils/statistics'

type MetaTrendsCardProps = {
  trends: Statistics['trends']
  events?: MetaEvent[]
  seasonStartsAt: string
}

type Period = 7 | 14 | 30

const PERIODS: readonly Period[] = [7, 14, 30]

const dayLabel = (startsAt: string, plus: number) => {
  const d = new Date(startsAt.length === 10 ? `${startsAt}T00:00:00Z` : startsAt)
  d.setUTCDate(d.getUTCDate() + plus)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

export const MetaTrendsCard = ({ trends, events = [], seasonStartsAt }: MetaTrendsCardProps) => {
  const [period, setPeriod] = useState<Period>(30)

  // Top 3-5 archetypes
  const topTrends = trends.slice(0, 4)
  const allPointsCount = topTrends[0]?.points?.length ?? 0
  const pointsSlice = Math.min(allPointsCount, period)
  const startIndex = Math.max(0, allPointsCount - pointsSlice)

  const labels = (topTrends[0]?.points ?? [])
    .slice(startIndex)
    .map(([d]) => dayLabel(seasonStartsAt, d - 1))

  const series = topTrends.map((t) => ({
    name: nameOf(t),
    data: t.points.slice(startIndex).map(([, share]) => share),
  }))

  const pctAxis = (v: number) => `${(v * 100).toFixed(0)}%`

  // Filter events
  const recentEvents: MetaEvent[] = events.length > 0
    ? events.slice(0, 4)
    : [
        {
          day: 1,
          kind: 'milestone',
          title: 'Início da Temporada',
          description: 'Abertura oficial e coleta de duelos ranqueados',
          impact: 'neutral',
        },
      ]

  return (
    <Panel
      title="Tendências e histórico do meta"
      actions={
        <div className="flex gap-1 ml-auto">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={twMerge(
                'px-2 py-0.5 text-xs font-mono rounded-xs transition-colors cursor-pointer',
                period === p
                  ? 'bg-azure text-ink font-bold'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-200'
              )}
            >
              {p} dias
            </button>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Line Chart */}
        <div>
          <span className="text-xs text-ink-muted font-medium block mb-2">
            Evolução da participação dos principais arquétipos
          </span>
          {series.length > 0 && labels.length > 0 ? (
            <LineChart
              labels={labels}
              series={series}
              format={pctAxis}
              height={140}
              area={false}
              className="border-0 p-0 bg-transparent"
            />
          ) : (
            <p className={NOTE}>Dados insuficientes para o período selecionado.</p>
          )}
        </div>

        {/* Events list */}
        <div className="flex flex-col gap-2 pt-2 border-t border-line">
          <span className="text-xs font-semibold text-ink-dim">
            Eventos e mudanças relevantes
          </span>

          <div className="flex flex-col gap-1.5">
            {recentEvents.map((ev, i) => {
              const icon =
                ev.kind === 'rise'
                  ? 'mdi:trending-up'
                  : ev.kind === 'drop'
                  ? 'mdi:trending-down'
                  : 'mdi:calendar-star'

              const iconColor =
                ev.impact === 'positive'
                  ? 'text-win bg-win/15'
                  : ev.impact === 'negative'
                  ? 'text-loss bg-loss/15'
                  : 'text-gold bg-gold/15'

              return (
                <div
                  key={`${ev.day}-${i}`}
                  className="flex items-start gap-2.5 p-2 bg-surface-200 border border-line rounded-xs text-xs"
                >
                  <div className={twMerge('size-6 rounded-xs flex items-center justify-center shrink-0 mt-0.5', iconColor)}>
                    <Icon icon={icon} className="text-sm" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink truncate">{ev.title}</span>
                      <span className="font-mono text-[10px] text-ink-muted ml-auto shrink-0">
                        Dia {ev.day}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-dim line-clamp-1 mt-0.5">
                      {ev.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Panel>
  )
}
