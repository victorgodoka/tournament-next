'use client'

/** The overview's smaller blocks. Each hides itself on a season frozen before its data existed. */

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Panel } from '@ui/panel'
import { archKey, deckHref, localHours, type StatArchetype, type Statistics, type StatisticsScope } from '@utils/statistics'
import { nameOf, NOTE, pct } from '../DeepDive'
import { dayLabel } from './MetaOverview'

const BAND_DECKS = 6
const PILOT_ROWS = 6
const PILOT_SCALE = 0.5
const PILOT_LINE = 0.25
const HISTORY_ROWS = 8
const PREVIOUS_ROWS = 6
const COLORS = ['series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6'] as const

/** Who the rating tiers play: the top decks' share in each band, "Others" for the rest. */
export const RatingMeta = ({ data }: { data: Statistics }) => {
  const t = useTranslations('Statistics.overview')
  const bands = data.ratingTiers ?? []
  const decks = data.archetypes.filter((a) => a.ratingShares?.length === bands.length).slice(0, BAND_DECKS)
  if (!bands.length || !decks.length) return null
  return (
    <Panel title={t('byRating')} meta={t('byRatingMeta')}>
      <div className="flex flex-col gap-3">
        <p className={NOTE}>{t('byRatingNote')}</p>
        {bands.map((band, i) => {
          const shares = decks.map((d) => d.ratingShares![i] ?? 0)
          const name = `${band.tier}${band.plus ? '+' : ''}`
          return (
            <div key={band.tier} className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 min-[720px]:grid-cols-[132px_minmax(0,1fr)]">
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-ink">{name}</span>
                <span className="font-mono text-[11px] text-ink-muted">{t('duelists', { count: band.players.toLocaleString('en-US') })}</span>
              </span>
              <div role="img" aria-label={`${name}: ${decks.map((d, k) => `${nameOf(d)} ${pct(shares[k])}`).join(', ')}`} className="flex h-5 gap-px bg-surface-200">
                {decks.map((d, k) => <span key={archKey(d.archetype)} title={`${nameOf(d)} ${pct(shares[k])}`} style={{ width: `${shares[k]! * 100}%`, background: `var(--color-${COLORS[k]})` }} />)}
              </div>
            </div>
          )
        })}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {decks.map((d, k) => (
            <span key={archKey(d.archetype)} className="flex items-center gap-1.5 text-xs text-ink-dim">
              <span aria-hidden className="size-2" style={{ background: `var(--color-${COLORS[k]})` }} />{nameOf(d)}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  )
}

/** The decks whose numbers lean most on a handful of duelists. */
export const PilotConcentration = ({ archetypes, scope }: { archetypes: StatArchetype[]; scope: StatisticsScope }) => {
  const t = useTranslations('Statistics.overview')
  const rows = archetypes.filter((a) => a.pilotShare != null).sort((a, b) => b.pilotShare! - a.pilotShare!).slice(0, PILOT_ROWS)
  if (!rows.length) return null
  return (
    <Panel title={t('pilots')}>
      <div className="flex flex-col gap-2.5">
        <p className={NOTE}>{t('pilotsNote')}</p>
        {rows.map((a) => (
          <div key={archKey(a.archetype)} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_52px] items-center gap-3 text-sm">
            <Link href={deckHref(a.archetype, scope)} className="truncate font-semibold text-ink hover:text-cyan">{nameOf(a)}</Link>
            <span className="relative block h-2 bg-surface-200" aria-hidden>
              <span className={twMerge('block h-2', a.pilotShare! >= PILOT_LINE ? 'bg-gold' : 'bg-series-3')} style={{ width: `${Math.min(100, (a.pilotShare! / PILOT_SCALE) * 100)}%` }} />
              <span className="absolute -top-1 h-4 w-px bg-ink-muted" style={{ left: `${(PILOT_LINE / PILOT_SCALE) * 100}%` }} />
            </span>
            <span className="text-right font-mono text-xs text-ink tabular-nums">{pct(a.pilotShare)}</span>
          </div>
        ))}
        <span className="text-ink-muted signal-sm">{t('pilotsScale')}</span>
      </div>
    </Panel>
  )
}

const TIER_CELL: Record<string, string> = { 1: 'bg-series-1 text-space-000', 1.5: 'bg-series-3 text-ink', 2: 'bg-series-5 text-ink', 3: 'bg-surface-300 text-ink', 4: 'bg-surface-200 text-ink-dim' }

/** A row per deck, a cell per day: the tier over the 7 days ending that day. */
export const TierHistory = ({ trends, seasonStartsAt }: { trends: Statistics['trends']; seasonStartsAt: string }) => {
  const t = useTranslations('Statistics.overview')
  const locale = useLocale()
  const rows = trends.filter((d) => d.tiers).slice(0, HISTORY_ROWS)
  if (!rows.length) return null
  const days = rows[0]!.points.map(([d]) => dayLabel(locale, seasonStartsAt, d - 1))
  return (
    <Panel title={t('tierHistory')}>
      <div className="flex flex-col gap-3">
        <p className={NOTE}>{t('tierHistoryNote')}</p>
        <div className="overflow-x-auto">
          <div className="flex min-w-max flex-col gap-0.5">
            {rows.map((d) => (
              <div key={archKey(d.archetype)} className="flex items-center gap-0.5">
                <span className="sticky left-0 w-36 flex-none truncate bg-surface-100 pr-2 text-[13px] font-semibold text-ink min-[720px]:w-44">{nameOf(d)}</span>
                {d.tiers!.map((tier, i) => (
                  <span key={i} title={`${days[i]} · ${tier ? `T${tier}` : '−'}`} className={twMerge('grid h-7 w-8 flex-none place-items-center font-mono text-[11px]', tier ? TIER_CELL[tier] : 'bg-space-000 text-ink-muted')}>
                    {tier ?? '−'}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <span className="text-ink-muted signal-sm">{t('tierHistoryLegend')}</span>
      </div>
    </Panel>
  )
}

/** The previous season's final numbers, by archetype key. */
export type PreviousSeason = { label: string; decks: Record<string, { share: number; winRate: number | null }> }

/** The biggest share moves among the decks on the page, against the season before. */
export const VsPrevious = ({ archetypes, previous }: { archetypes: StatArchetype[]; previous: PreviousSeason }) => {
  const t = useTranslations('Statistics.overview')
  const rows = archetypes
    .map((a) => ({ a, before: previous.decks[archKey(a.archetype)] ?? null }))
    .sort((x, y) => Math.abs(y.a.metaShare - (y.before?.share ?? 0)) - Math.abs(x.a.metaShare - (x.before?.share ?? 0)))
    .slice(0, PREVIOUS_ROWS)
  return (
    <Panel title={t('vsPrevious')} meta={t('vsPreviousMeta', { label: previous.label })}>
      <div className="grid grid-cols-1 gap-px border border-line bg-line min-[720px]:grid-cols-2 min-[1100px]:grid-cols-3">
        {rows.map(({ a, before }) => {
          const delta = a.metaShare - (before?.share ?? 0)
          return (
            <div key={archKey(a.archetype)} className="flex flex-col gap-1.5 bg-surface-100 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-bold text-ink">{nameOf(a)}</span>
                <span className={twMerge('flex-none font-mono text-xs', delta >= 0 ? 'text-win' : 'text-loss')}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta * 100).toFixed(1)}</span>
              </div>
              <span className="font-mono text-xs text-ink-dim tabular-nums">{t('share')} {before ? pct(before.share) : t('newDeck')} → {pct(a.metaShare)}</span>
              <span className="font-mono text-xs text-ink-muted tabular-nums">{t('winRate')} {before ? pct(before.winRate) : '—'} → {pct(a.winRate)}</span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

const noSubscribe = () => () => {}

/** Duels by hour, moved from UTC to the viewer's clock. The server renders UTC, the browser its own offset. */
export const BusiestHours = ({ hours }: { hours?: number[] }) => {
  const t = useTranslations('Statistics.overview')
  const offset = useSyncExternalStore(noSubscribe, () => new Date().getTimezoneOffset() / 60, () => 0)
  if (!hours?.length) return null
  const local = localHours(hours, offset)
  const max = Math.max(...local, 1)
  return (
    <Panel title={t('hours')} meta={t('hoursMeta')}>
      <div role="img" aria-label={t('hoursLabel', { hour: local.indexOf(max) })} className="grid h-32 grid-cols-[repeat(24,minmax(0,1fr))] items-end gap-0.5">
        {local.map((n, hour) => <span key={hour} title={`${hour}:00 · ${n}`} className="bg-series-1" style={{ height: `${(n / max) * 100}%` }} />)}
      </div>
      <div className="mt-1 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5" aria-hidden>
        {local.map((_, hour) => <span key={hour} className="text-center font-mono text-[10px] text-ink-muted">{hour % 6 === 0 ? hour : ''}</span>)}
      </div>
    </Panel>
  )
}
