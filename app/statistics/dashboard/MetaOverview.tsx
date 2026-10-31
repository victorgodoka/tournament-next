'use client'

import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Panel } from '@ui/panel'
import { StatGrid } from '@ui/stat-grid'
import { archKey, deckHref, type StatisticsScope, type Statistics } from '@utils/statistics'
import { POWER_BANDS, POWER_MIN_PLAYERS, POWER_MIN_SHARE } from '@utils/power-tier'
import Link from 'next/link'
import { pct, nameOf, NOTE, num } from '../DeepDive'

/** "19/10" of a YYYY-MM-DD + plus days, UTC so server and client agree. */
export const dayLabel = (locale: string, iso: string, plus = 0) => {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  d.setUTCDate(d.getUTCDate() + plus)
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

/** The dashboard's row text: Figtree names, mono figures, as in the ranking and the matrix. */
const NAME = 'text-sm font-semibold text-ink'
const FIGURE = 'font-mono text-xs text-ink-muted tabular-nums'

const TIER_ROWS = [
  { key: 'tier1', label: 'T1', color: 'series-1' },
  { key: 'tier15', label: 'T1.5', color: 'series-3' },
  { key: 'tier2', label: 'T2', color: 'series-5' },
  { key: 'tier3', label: 'T3', color: 'series-4' },
  { key: 'tier4', label: 'T4', color: 'series-6' },
  { key: 'others', label: null, color: 'line-mid' },
] as const

/** The numbers the page stands on, then who the coin favors. */
export const SeasonGlance = ({ data }: { data: Statistics }) => {
  const t = useTranslations('Statistics.overview')
  const dist = data.tierDistribution
  const tiered = dist ? TIER_ROWS.reduce((n, { key }) => (key === 'others' ? n : n + (dist[key]?.archetypes ?? 0)), 0) : null
  const rows = [
    [t('allGames'), data.turnOrder.all],
    [t('game1'), data.turnOrder.game1],
    [t('postSide'), data.turnOrder.postSide],
  ] as const
  return (
    <div className="flex flex-col gap-4">
      <StatGrid
        columns={4}
        items={[
          { label: t('kpi.deckGames'), value: num(data.totals.games), hint: t('kpi.deckGamesHint') },
          { label: t('kpi.matches'), value: num(data.totals.matches), hint: t('kpi.matchesHint') },
          { label: t('kpi.players'), value: num(data.totals.players), hint: t('kpi.playersHint') },
          { label: t('kpi.archetypes'), value: num(data.totals.archetypes), hint: tiered != null ? t('kpi.tiered', { count: tiered }) : undefined },
        ]}
      />
      <Panel title={t('turn')} meta={t('turnMeta')}>
        <div className="grid grid-cols-1 gap-5 min-[720px]:grid-cols-3">
          {rows.map(([label, split]) => {
            const first = split.first.winRate
            return (
              <div key={label} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className={NAME}>{label}</span>
                  <span className={FIGURE}>{t('turnGames', { count: num(split.first.games + split.second.games) })}</span>
                </div>
                <div className="flex h-2 gap-0.5" aria-hidden>
                  <span className="block h-2 bg-series-1" style={{ width: `${(first ?? 0.5) * 100}%` }} />
                  <span className="block h-2 flex-1 bg-series-3" />
                </div>
                <div className="flex justify-between gap-3 text-xs text-ink-dim">
                  <span className="flex items-center gap-2"><span className="size-2 bg-series-1" />{t('first', { rate: pct(first) })}</span>
                  <span className="flex items-center gap-2"><span className="size-2 bg-series-3" />{t('second', { rate: pct(split.second.winRate) })}</span>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}

const EVENTS = 5

/** How the meta divides into tiers, and what moved. `metaEvents` carries no text: the page words it. */
export const MetaShape = ({ data, scope }: { data: Statistics; scope: StatisticsScope }) => {
  const t = useTranslations('Statistics.overview')
  const dist = data.tierDistribution
  const rows = dist ? TIER_ROWS.map((row) => ({ ...row, share: dist[row.key]?.share ?? 0, decks: dist[row.key]?.archetypes ?? 0 })).filter((r) => r.key !== 'tier15' || r.decks) : []
  // An API older than the structured events sends title/description and no rates: skip those rows.
  const events = (data.metaEvents ?? []).filter((e) => typeof e.from === 'number' && Array.isArray(e.archetype)).slice(0, EVENTS)
  return (
    <div className="grid grid-cols-1 gap-4 min-[980px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel title={t('tiers')} meta={t('tiersMeta')}>
        <div className="flex flex-col gap-4">
          <p className={NOTE}>{t('tierRule')}</p>
          <div role="img" aria-label={rows.map((r) => `${r.label ?? t('others')} ${pct(r.share)}`).join(', ')} className="flex h-8 gap-0.5">
            {rows.map((r) => (r.share ? <span key={r.key} style={{ width: `${r.share * 100}%`, background: `var(--color-${r.color})` }} /> : null))}
          </div>
          <div className="grid grid-cols-2 gap-px border border-line bg-line min-[720px]:grid-cols-3">
            {rows.map((r) => (
              <div key={r.key} className="flex flex-col gap-1 bg-surface-100 px-3 py-2.5">
                <span className="flex items-center gap-2"><span className="size-2 flex-none" style={{ background: `var(--color-${r.color})` }} /><span className={NAME}>{r.label ?? t('others')}</span></span>
                <span className={FIGURE}>{pct(r.share)} · {t('decks', { count: r.decks })}</span>
              </div>
            ))}
          </div>
          <p className="text-ink-muted signal-sm">
            {t('tierBands', { t1: POWER_BANDS[0] * 100, t2: POWER_BANDS[1] * 100, t3: POWER_BANDS[2] * 100, t4: POWER_BANDS[3] * 100, share: POWER_MIN_SHARE * 100, players: POWER_MIN_PLAYERS })}
          </p>
        </div>
      </Panel>
      <Panel title={t('events')}>
        <div className="flex flex-col gap-3">
          <p className={NOTE}>{t('eventsNote')}</p>
          {events.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {events.map((e) => {
                const up = e.kind === 'shareRise' || e.kind === 'winRateRise'
                return (
                  <li key={`${e.kind}-${archKey(e.archetype)}`} className="flex items-center gap-3 py-2.5">
                    <span aria-hidden className={twMerge('text-xs', up ? 'text-win' : 'text-loss')}>{up ? '▲' : '▼'}</span>
                    <span className="flex min-w-0 flex-col">
                      <Link href={deckHref(e.archetype, scope)} className={twMerge(NAME, 'truncate hover:text-cyan')}>{nameOf({ name: e.name ?? null, archetype: e.archetype })}</Link>
                      <span className={FIGURE}>{t(`eventMetric.${e.kind}`)} · {pct(e.from)} → {pct(e.to)}</span>
                    </span>
                    <span className={twMerge(FIGURE, 'ml-auto text-right whitespace-nowrap')}>{t('eventDay', { day: e.day, games: num(e.games) })}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className={NOTE}>{t('noEvents')}</p>
          )}
        </div>
      </Panel>
    </div>
  )
}
