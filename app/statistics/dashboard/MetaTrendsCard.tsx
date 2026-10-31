'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { LineChart } from '@ui/chart'
import { Panel } from '@ui/panel'
import { archKey, type StatArchetype, type Statistics } from '@utils/statistics'
import { nameOf, NOTE } from '../DeepDive'
import { DeckPicker } from './controls'
import { dayLabel } from './MetaOverview'

type Period = 7 | 14 | 30
const PERIODS: readonly Period[] = [7, 14, 30]
/** The chart palette has six series colors: past that, two lines would share one. */
const MAX_LINES = 6

type MetaTrendsCardProps = {
  archetypes: StatArchetype[]
  trends: Statistics['trends']
  seasonStartsAt: string
}

export const MetaTrendsCard = ({ archetypes, trends, seasonStartsAt }: MetaTrendsCardProps) => {
  const t = useTranslations('Statistics.trends')
  const locale = useLocale()
  const [period, setPeriod] = useState<Period | null>(null)
  const [metric, setMetric] = useState<'share' | 'winRate'>('share')
  const [lines, setLines] = useState(() => trends.slice(0, MAX_LINES).map((d) => archKey(d.archetype)))

  const byKey = new Map(trends.map((d) => [archKey(d.archetype), d]))
  const shown = lines.flatMap((k) => byKey.get(k) ?? [])
  const days = trends[0]?.points.length ?? 0
  // Only windows shorter than the season so far: a 30-day button on a 3-day season changes nothing.
  const periods = PERIODS.filter((p) => p < days)
  const from = period ? Math.max(0, days - period) : 0
  const labels = (trends[0]?.points ?? []).slice(from).map(([d]) => dayLabel(locale, seasonStartsAt, d - 1))
  const series = shown.map((d) => ({ name: nameOf(d), data: d.points.slice(from).map(([, share, wr]) => (metric === 'share' ? share : (wr ?? 0))) }))

  const toggle = (on: boolean, label: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={twMerge('cursor-pointer px-2 py-0.5 font-mono text-xs transition-colors', on ? 'bg-surface-300 text-azure-lift' : 'text-ink-muted hover:bg-surface-200 hover:text-ink')}
    >
      {label}
    </button>
  )

  return (
    <Panel title={t('title')} meta={t('meta', { count: days })}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DeckPicker pool={archetypes} selected={lines} onChange={setLines} max={MAX_LINES} label={t('add')} removeLabel={(name) => t('remove', { name })} />
          <div className="flex flex-wrap gap-3">
            <div className="flex gap-1">
              {toggle(metric === 'share', t('share'), () => setMetric('share'))}
              {toggle(metric === 'winRate', t('winRate'), () => setMetric('winRate'))}
            </div>
            {periods.length ? (
              <div className="flex gap-1">
                {[null, ...periods].map((p) => toggle(period === p, p ? t('days', { count: p }) : t('all'), () => setPeriod(p)))}
              </div>
            ) : null}
          </div>
        </div>

        {series.length && labels.length ? (
          <LineChart labels={labels} series={series} format={(v) => `${(v * 100).toFixed(0)}%`} height={340} area={false} className="border-0 bg-transparent p-0" />
        ) : (
          <p className={NOTE}>{t('empty')}</p>
        )}
      </div>
    </Panel>
  )
}
