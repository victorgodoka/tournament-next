'use client'

/**
 * The top of /statistics: logins and ranked activity of the whole game, from GET /statistics/omega.
 * Cards and daily charts add both ladders up; the tier split follows the page's ladder.
 */

import { useState } from 'react'
import { BarList, LineChart } from '@ui/chart'
import { Segmented } from '@ui/choice'
import { DataTable } from '@ui/data-table'
import { StatGrid, type Stat } from '@ui/stat-grid'
import type { OmegaActivity as Activity, OmegaCard, OmegaRange } from '@utils/statistics'
import type { RankedLadderId, Tier } from '@utils/types'
import { num, NOTE, SPLIT } from './DeepDive'
import { Section } from './MetaStatistics'

const RANGES: OmegaRange[] = [7, 14, 30]
const FORMAT: Record<RankedLadderId, string> = { tcg: 'TCG', genesys: 'Genesys' }
const tierColor = (tier: Tier) => `tier-${tier.toLowerCase()}`

/** "14 Aug" of a `YYYY-MM-DD`. UTC, so server and client agree. */
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
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
  const [range, setRange] = useState<OmegaRange>(14)
  const { cards } = data
  // UTC, so the server render and the browser agree.
  const hour = new Date(data.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'

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
      <Section num="Ω1" label="Omega today" stamp={`Updated ${hour} · against the same hour`}>
        <StatGrid
          items={[
            card('Unique logins today', cards.logins, 'vs yesterday', 'No reading yesterday at this hour'),
            card('Unique logins · 7 days', cards.weekLogins, 'vs 7 days before', 'No reading 7 days ago at this hour'),
            card('Ranked duels today', cards.duels, 'vs yesterday', 'None yesterday at this hour'),
            card('Ranked duels · 7 days', cards.weekDuels, 'vs 7 days before', 'None 7 days before'),
          ]}
        />
      </Section>

      <Section num="Ω2" label="Daily activity" stamp="Closed days · today left out · TCG + Genesys">
        <Segmented
          label="Days"
          size="sm"
          options={RANGES.map((r) => ({ value: r, label: `${r} days` }))}
          value={range}
          onChange={setRange}
        />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 min-[980px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <LineChart title="Unique logins" subtitle="Per day" labels={labels} series={[{ name: 'Logins', data: days.map((d) => d.logins ?? 0) }]} format={num} directLabels={false} />
          <LineChart title="Ranked duels" subtitle="Per day" labels={labels} series={[{ name: 'Duels', data: days.map((d) => d.duels) }]} format={num} directLabels={false} />
          <LineChart title="Unique ranked players" subtitle="Played at least one ranked duel" labels={labels} series={[{ name: 'Players', data: days.map((d) => d.players) }]} format={num} directLabels={false} />
          <LineChart title="Games per player" subtitle="Per day" labels={labels} series={[{ name: 'Games per player', data: perDay.map((v) => v ?? 0) }]} format={avg} directLabels={false} />
        </div>
        <StatGrid
          columns={3}
          items={[
            { label: `Games per player · ${range} days`, value: avg(ratio(total.games, total.players)), hint: `${num(total.games / 2)} duels · ${num(total.players)} players` },
            { label: 'Games per player · per day', value: avg(mean(perDay)), hint: 'Mean of the daily figures' },
            { label: `Unique ranked players · ${range} days`, value: num(total.players), hint: 'Accounts, both ladders' },
          ]}
        />
      </Section>

      <Section num="Ω3" label={`By tier · ${FORMAT[ladder]}`} stamp="Tier of the open season's rating">
        <div className={SPLIT}>
          <div className="overflow-x-auto">
            <DataTable
              caption={`Last ${range} closed days · ${FORMAT[ladder]} duels only`}
              className="min-w-140"
              columns={[
                { key: 'tier', label: 'Tier', strong: true, render: (t) => t.tier },
                { key: 'population', label: 'Population', numeric: true, render: (t) => num(t.population) },
                { key: 'active', label: 'Played', numeric: true, render: (t) => num(t.active) },
                { key: 'total', label: 'Games / player', numeric: true, render: (t) => avg(t.total) },
                { key: 'perDay', label: 'Per day', numeric: true, render: (t) => avg(t.perDay) },
              ]}
              rows={[...tiers].reverse()}
              rowKey={(t) => t.tier}
            />
          </div>
          <BarList
            title="Population by tier"
            subtitle="Players in the open season"
            items={[...split.population].reverse().map((p) => ({ label: p.tier, value: p.players, color: tierColor(p.tier) }))}
            format={num}
          />
        </div>
        <LineChart
          title="Games per player by tier"
          subtitle="Per day"
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
        <p className={NOTE}>
          A game is one side of a ranked duel, so one duel counts once for each player. Population and the split use each player&apos;s current rating in the open
          season; someone who only played the previous season counts in the daily totals, not here.
        </p>
      </Section>
    </>
  )
}
