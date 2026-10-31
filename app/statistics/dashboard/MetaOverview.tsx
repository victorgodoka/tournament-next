'use client'

import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Panel } from '@ui/panel'
import { StatGrid } from '@ui/stat-grid'
import type { Statistics } from '@utils/statistics'
import { pct, num } from '../DeepDive'

/** "19/10" of a YYYY-MM-DD + plus days, UTC so server and client agree. */
export const dayLabel = (locale: string, iso: string, plus = 0) => {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  d.setUTCDate(d.getUTCDate() + plus)
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

/** The first row: the numbers the page stands on, in the same StatGrid as the deep dive and the server activity. */
const KpiStrip = ({ data }: { data: Statistics }) => {
  const t = useTranslations('Statistics.overview')
  const locale = useLocale()
  const last = data.syncedDays.last
  return (
    <StatGrid
      columns={4}
      items={[
        { label: t('kpi.deckGames'), value: num(data.totals.games) },
        { label: t('kpi.matches'), value: num(data.totals.matches) },
        { label: t('kpi.players'), value: num(data.totals.players) },
        {
          label: t('kpi.updated'),
          value: last ? new Date(`${last}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' }) : '—',
          hint: t('kpi.days', { count: data.syncedDays.count }),
        },
      ]}
    />
  )
}

/** The dashboard's row text: Figtree names, mono figures, as in the ranking and the matrix. */
const NAME = 'text-sm font-semibold text-ink'
const FIGURE = 'font-mono text-xs text-ink-muted tabular-nums'

const TIER_ROWS = [
  { key: 'tier1', label: 'T1', bar: 'bg-tier-diamond' },
  { key: 'tier15', label: 'T1.5', bar: 'bg-tier-diamond' },
  { key: 'tier2', label: 'T2', bar: 'bg-tier-platinum' },
  { key: 'tier3', label: 'T3', bar: 'bg-tier-silver' },
  { key: 'tier4', label: 'T4', bar: 'bg-tier-gold' },
  { key: 'others', label: null, bar: 'bg-line-mid' },
] as const

const TierCard = ({ data }: { data: Statistics }) => {
  const t = useTranslations('Statistics.overview')
  const dist = data.tierDistribution
  if (!dist) return null
  const max = Math.max(...TIER_ROWS.map(({ key }) => dist[key].share), 0.01)
  return (
    <Panel title={t('tiers')} meta={t('tiersMeta')}>
      <div className="flex flex-col gap-2.5">
        {TIER_ROWS.map(({ key, label, bar }) => (
          <div key={key} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3">
            <span className={NAME}>{label ?? t('others')}</span>
            <span className="relative h-1.5 bg-surface-200">
              <span className={twMerge('block h-1.5', bar)} style={{ width: `${(dist[key].share / max) * 100}%` }} />
            </span>
            <span className={twMerge(FIGURE, 'whitespace-nowrap text-right')}>
              {pct(dist[key].share)} · {t('decks', { count: dist[key].archetypes })}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

const TurnCard = ({ data }: { data: Statistics }) => {
  const t = useTranslations('Statistics.overview')
  const rows = [
    [t('game1'), data.turnOrder.game1],
    [t('postSide'), data.turnOrder.postSide],
  ] as const
  return (
    <Panel title={t('turn')} meta={t('turnMeta')}>
      <div className="flex flex-col gap-4">
        {rows.map(([label, split]) => {
          const f = split.first.winRate, s = split.second.winRate
          const share = f != null && s != null && f + s > 0 ? (f / (f + s)) * 100 : 50
          return (
            <div key={label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className={NAME}>{label}</span>
                <span className={FIGURE}>{t('turnGames', { count: num(split.first.games + split.second.games) })}</span>
              </div>
              <div className="flex h-2 gap-0.5" aria-hidden>
                <span className="block h-2 bg-series-1" style={{ width: `${share}%` }} />
                <span className="block h-2 flex-1 bg-series-3" />
              </div>
              <div className="flex justify-between gap-3 text-xs text-ink-dim">
                <span className="flex items-center gap-2"><span className="size-2 bg-series-1" />{t('first', { rate: pct(f) })}</span>
                <span className="flex items-center gap-2"><span className="size-2 bg-series-3" />{t('second', { rate: pct(s) })}</span>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

/** KPIs on the first row; the panorama (tier split, turn advantage) under it, half and half. */
export const MetaOverview = ({ data }: { data: Statistics }) => (
  <div className="flex flex-col gap-4">
    <KpiStrip data={data} />
    <div className="grid grid-cols-1 gap-4 min-[980px]:grid-cols-2">
      <TierCard data={data} />
      <TurnCard data={data} />
    </div>
  </div>
)
