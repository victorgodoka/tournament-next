'use client'

/**
 * Logins and ranked activity of the whole game, from GET /statistics/omega.
 * Cards and daily charts add both ladders up; the tier split follows the page's ladder.
 */

import { useState, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BarList, LineChart } from '@ui/chart'
import { Segmented } from '@ui/choice'
import { DataTable } from '@ui/data-table'
import { Panel } from '@ui/panel'
import { RailHead } from '@ui/rail-head'
import { StatGrid, type Stat } from '@ui/stat-grid'
import { localHours, type OmegaActivity as Activity, type OmegaCard, type OmegaRange } from '@utils/statistics'
import type { RankedLadderId, Tier } from '@utils/types'
import { num, NOTE, SPLIT } from '../shared'

const Section = ({ num: n, label, stamp, children }: { num: string; label: string; stamp?: React.ReactNode; children: React.ReactNode }) => (
  <section aria-label={label} className="mt-12 flex scroll-mt-24 flex-col gap-6 min-[720px]:mt-16">
    {/* The stamp is provenance, not content: it gives way on a phone. */}
    <RailHead num={n} label={label} stamp={stamp ? <span className="max-[720px]:hidden">{stamp}</span> : undefined} as="h2" className="px-0 [&_h2]:text-xl [&_h2]:leading-7" />
    {children}
  </section>
)

const RANGES: OmegaRange[] = [7, 14, 30]
const FORMAT: Record<RankedLadderId, string> = { tcg: 'TCG', genesys: 'Genesys' }
const tierColor = (tier: Tier) => `tier-${tier.toLowerCase()}`

const ratio = (a: number, b: number) => (b ? a / b : null)
const avg = (n: number | null) => (n == null ? '—' : n.toFixed(2))
/** Mean of the days that had someone: a quiet day doesn't drag it to zero. */
const mean = (values: (number | null)[]) => {
  const real = values.filter((v): v is number => v != null)
  return real.length ? real.reduce((s, v) => s + v, 0) / real.length : null
}

const card = (label: string, c: OmegaCard, versus: string, missing: string): Stat => {
  const change = c.previous ? (c.current - c.previous) / c.previous : null
  return change == null
    ? { label, value: num(c.current), hint: missing }
    : { label, value: num(c.current), delta: change, deltaLabel: `${Math.abs(change * 100).toFixed(1)}% ${versus}` }
}

export const OmegaActivity = ({ data, ladder }: { data: Activity; ladder: RankedLadderId }) => {
  const t = useTranslations('Statistics.omega')
  const locale = useLocale()
  const [range, setRange] = useState<OmegaRange>(14)
  const { cards } = data
  /** "14/10" of a `YYYY-MM-DD`. UTC, so server and client agree. */
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  const hour = new Date(data.updatedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'

  const days = data.daily.slice(-range)
  const labels = days.map((d) => day(d.day))
  const perDay = days.map((d) => ratio(2 * d.duels, d.players))
  const total = data.totals[range]

  const split = data.ladders[ladder]
  const tierDays = split.daily.slice(-range)
  const tierTotals = split.totals[range]
  const tiers = split.population.map(({ tier, players }) => {
    const cell = tierTotals[tier]
    return {
      tier,
      population: players,
      active: cell?.players ?? 0,
      total: cell ? ratio(cell.games, cell.players) : null,
      perDay: mean(tierDays.map((d) => (d.tiers[tier] ? ratio(d.tiers[tier]!.games, d.tiers[tier]!.players) : null))),
    }
  })

  return (
    <>
      <Section num="Ω1" label={t('today')} stamp={t('todayStamp', { hour })}>
        <StatGrid
          items={[
            card(t('logins'), cards.logins, t('vsYesterday'), t('noYesterday')),
            card(t('weekLogins'), cards.weekLogins, t('vsWeek'), t('noWeek')),
            card(t('duels'), cards.duels, t('vsYesterday'), t('noYesterday')),
            card(t('weekDuels'), cards.weekDuels, t('vsWeek'), t('noWeek')),
          ]}
        />
      </Section>

      <Section num="Ω2" label={t('daily')} stamp={t('dailyStamp')}>
        <Segmented label={t('days')} size="sm" options={RANGES.map((r) => ({ value: r, label: t('nDays', { count: r }) }))} value={range} onChange={setRange} />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 min-[980px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <LineChart title={t('loginsChart')} subtitle={t('perDay')} labels={labels} series={[{ name: t('loginsChart'), data: days.map((d) => d.logins ?? 0) }]} format={num} directLabels={false} />
          <LineChart title={t('duelsChart')} subtitle={t('perDay')} labels={labels} series={[{ name: t('duelsChart'), data: days.map((d) => d.duels) }]} format={num} directLabels={false} />
          <LineChart title={t('playersChart')} subtitle={t('playersHint')} labels={labels} series={[{ name: t('playersChart'), data: days.map((d) => d.players) }]} format={num} directLabels={false} />
          <LineChart title={t('gamesPerPlayer')} subtitle={t('perDay')} labels={labels} series={[{ name: t('gamesPerPlayer'), data: perDay.map((v) => v ?? 0) }]} format={avg} directLabels={false} />
        </div>
        <StatGrid
          columns={3}
          items={[
            { label: t('gamesPerPlayerRange', { count: range }), value: avg(ratio(total.games, total.players)), hint: t('duelsPlayers', { duels: num(total.games / 2), players: num(total.players) }) },
            { label: t('gamesPerPlayerDay'), value: avg(mean(perDay)), hint: t('meanHint') },
            { label: t('playersRange', { count: range }), value: num(total.players), hint: t('accountsHint') },
          ]}
        />
      </Section>

      <Section num="Ω3" label={t('byTier', { format: FORMAT[ladder] })} stamp={t('byTierStamp')}>
        <div className={SPLIT}>
          <div className="overflow-x-auto">
            <DataTable
              caption={t('tierCaption', { count: range, format: FORMAT[ladder] })}
              className="min-w-140"
              columns={[
                { key: 'tier', label: t('cols.tier'), strong: true, render: (r) => r.tier },
                { key: 'population', label: t('cols.population'), numeric: true, render: (r) => num(r.population) },
                { key: 'active', label: t('cols.played'), numeric: true, render: (r) => num(r.active) },
                { key: 'total', label: t('cols.gamesPerPlayer'), numeric: true, render: (r) => avg(r.total) },
                { key: 'perDay', label: t('cols.perDay'), numeric: true, render: (r) => avg(r.perDay) },
              ]}
              rows={[...tiers].reverse()}
              rowKey={(r) => r.tier}
            />
          </div>
          <BarList
            title={t('population')}
            subtitle={t('populationHint')}
            items={[...split.population].reverse().map((p) => ({ label: p.tier, value: p.players, color: tierColor(p.tier) }))}
            format={num}
          />
        </div>
        <LineChart
          title={t('tierChart')}
          subtitle={t('perDay')}
          labels={tierDays.map((d) => day(d.day))}
          series={tiers.map(({ tier }) => ({
            name: tier,
            color: tierColor(tier),
            data: tierDays.map((d) => (d.tiers[tier] ? ratio(d.tiers[tier]!.games, d.tiers[tier]!.players) ?? 0 : 0)),
          }))}
          format={avg}
          height={280}
          area={false}
        />
        <p className={NOTE}>{t('note')}</p>
      </Section>
    </>
  )
}

const noSubscribe = () => () => {}

/** Ranked duels per hour, on the viewer's clock. */
export const BusiestHours = ({ hours }: { hours?: number[] }) => {
  const t = useTranslations('Statistics.activity')
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
