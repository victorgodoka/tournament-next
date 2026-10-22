import { twMerge } from 'tailwind-merge'
import { LineChart } from '@ui/chart'
import { Panel } from '@ui/panel'
import type { Statistics } from '@utils/statistics'
import { pct, num, nameOf } from '../DeepDive'

type MetaOverviewProps = {
  data: Statistics
}

/** "14 Aug" of a YYYY-MM-DD + plus days, UTC so server and client agree. */
const day = (iso: string, plus = 0) => {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  d.setUTCDate(d.getUTCDate() + plus)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

const TREND_DECKS = 5

/* ----------------------------------------------------------------
 * Card 1: Server activity
 * ---------------------------------------------------------------- */

const ActivityCard = ({ data }: { data: Statistics }) => {
  const { totals, trends, season } = data

  // Build a tiny inline SVG sparkline from the first trend's share values
  const sparkPoints = trends[0]?.points.map(([, share]) => share) ?? []
  const hasSpark = sparkPoints.length >= 2
  let sparkSvg: React.ReactNode = null
  if (hasSpark) {
    const min = Math.min(...sparkPoints)
    const max = Math.max(...sparkPoints)
    const range = max - min || 1
    const W = 80, H = 40
    const pts = sparkPoints
      .map((v, i) => {
        const x = (i / (sparkPoints.length - 1)) * W
        const y = H - ((v - min) / range) * (H - 4) - 2
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
    sparkSvg = (
      <svg
        aria-hidden
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="flex-none"
        style={{ overflow: 'visible' }}
      >
        <polyline
          points={pts}
          fill="none"
          stroke="var(--color-series-1)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <Panel title="Atividade do servidor" meta={season.label}>
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[40px] leading-none text-ink tabular-nums">
              {num(totals.games)}
            </span>
            <span className="text-ink-muted signal-sm">Deck-games</span>
          </div>
          {hasSpark && <div className="pb-1">{sparkSvg}</div>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3">
          <span className="text-ink-dim signal-sm tabular-nums">
            {num(totals.matches)} partidas
          </span>
          <span className="text-ink-dim signal-sm tabular-nums">
            {num(totals.players)} jogadores
          </span>
        </div>
      </div>
    </Panel>
  )
}

/* ----------------------------------------------------------------
 * Card 2: Tier distribution
 * ---------------------------------------------------------------- */

const TIER_ROWS = [
  { key: 'tier1' as const, label: 'T1', barClass: 'bg-tier-diamond' },
  { key: 'tier2' as const, label: 'T2', barClass: 'bg-tier-platinum' },
  { key: 'tier3' as const, label: 'T3', barClass: 'bg-tier-silver' },
  { key: 'tier4' as const, label: 'T4', barClass: 'bg-tier-gold' },
  { key: 'others' as const, label: 'Outros', barClass: 'bg-line-mid' },
]

const TierDistCard = ({ data }: { data: Statistics }) => {
  const { tierDistribution, archetypes } = data

  type TierRow = { label: string; share: number; archetypeCount: number; barClass: string }
  let rows: TierRow[]

  if (tierDistribution) {
    rows = TIER_ROWS.map(({ key, label, barClass }) => ({
      label,
      share: tierDistribution[key].share,
      archetypeCount: tierDistribution[key].archetypes,
      barClass,
    }))
  } else {
    // Compute from archetypes manually using tier field
    const byTier: Record<number, { share: number; count: number }> = { 1: { share: 0, count: 0 }, 2: { share: 0, count: 0 }, 3: { share: 0, count: 0 }, 4: { share: 0, count: 0 } }
    let othersShare = 0, othersCount = 0
    for (const a of archetypes) {
      const t = a.tier
      if (t && t >= 1 && t <= 4) {
        byTier[t]!.share += a.metaShare
        byTier[t]!.count++
      } else {
        othersShare += a.metaShare
        othersCount++
      }
    }
    rows = [
      ...TIER_ROWS.slice(0, 4).map(({ key, label, barClass }, i) => ({
        label,
        share: byTier[i + 1]!.share,
        archetypeCount: byTier[i + 1]!.count,
        barClass,
      })),
      { label: 'Outros', share: othersShare, archetypeCount: othersCount, barClass: 'bg-line-mid' },
    ]
  }

  const maxShare = Math.max(...rows.map((r) => r.share), 0.01)

  return (
    <Panel title="Distribuição por tier" meta="Por meta share">
      <div className="flex flex-col gap-2.5">
        {rows.map(({ label, share, archetypeCount, barClass }) => (
          <div key={label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-[13px] leading-5 text-ink">{label}</span>
              <span className="text-ink-muted signal-sm tabular-nums">
                {pct(share)} · {archetypeCount} decks
              </span>
            </div>
            <div className="relative h-1.5 rounded-xs bg-surface-200">
              <span
                className={twMerge('block h-1.5 rounded-xs', barClass)}
                style={{ width: `${(share / maxShare) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

/* ----------------------------------------------------------------
 * Card 3: Turn advantage
 * ---------------------------------------------------------------- */

const TurnAdvantageCard = ({ data }: { data: Statistics }) => {
  const { turnOrder } = data
  const all = turnOrder.all
  const postSide = turnOrder.postSide

  const f = all.first.winRate
  const s = all.second.winRate
  const share = f != null && s != null && f + s > 0 ? (f / (f + s)) * 100 : 50

  const pf = postSide.first.winRate
  const ps = postSide.second.winRate

  return (
    <Panel title="Vantagem de turno" meta="Servidor inteiro">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-display text-[40px] leading-none text-ink">{pct(f)}</span>
          <span className="text-ink-muted signal">Indo primeiro</span>
        </div>
        <div className="flex h-2 gap-0.5" aria-hidden>
          <span className="block h-2 rounded-l-xs bg-series-1" style={{ width: `${share}%` }} />
          <span className="block h-2 flex-1 rounded-r-xs bg-series-3" />
        </div>
        <div className="flex justify-between gap-3 text-[13px] leading-5 text-ink-dim">
          <span className="flex items-center gap-2">
            <span className="size-2 bg-series-1" />
            Primeiro {pct(f)}
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 bg-series-3" />
            Segundo {pct(s)}
          </span>
        </div>
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <span className="text-ink-muted signal-sm">Pós-side</span>
          <div className="flex justify-between gap-3 text-[13px] leading-5 text-ink-dim">
            <span className="flex items-center gap-2">
              <span className="size-2 bg-series-1" />
              Primeiro {pct(pf)}
            </span>
            <span className="flex items-center gap-2">
              <span className="size-2 bg-series-3" />
              Segundo {pct(ps)}
            </span>
          </div>
        </div>
      </div>
    </Panel>
  )
}

/* ----------------------------------------------------------------
 * Card 4: Participation trend
 * ---------------------------------------------------------------- */

const pctAxis = (v: number) => (v * 100).toFixed(1) + '%'

const TrendCard = ({ data }: { data: Statistics }) => {
  const { trends, season } = data
  const top = trends.slice(0, TREND_DECKS)
  const labels = (top[0]?.points ?? []).map(([d]) => day(season.startsAt, d - 1))
  const series = top.map((t) => ({
    name: t.name ?? `Setcode ${t.archetype.join('/')}`,
    data: t.points.map(([, share]) => share),
  }))

  if (!labels.length) {
    return (
      <Panel title="Tendência de participação" meta="Top archetypes">
        <p className="text-ink-muted signal-sm">Sem dados de tendência ainda.</p>
      </Panel>
    )
  }

  return (
    <Panel title="Tendência de participação" meta={`Top ${top.length} decks`}>
      <div className="flex flex-col gap-3">
        <LineChart
          title="Meta share por dia"
          subtitle={`Top ${top.length} decks`}
          labels={labels}
          series={series}
          format={pctAxis}
          height={140}
          area
        />
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {top.map((t, i) => (
            <span key={i} className="flex items-center gap-1.5 text-[12px] leading-5 text-ink-dim">
              <span
                className="size-2 flex-none rounded-xs"
                style={{ background: `var(--color-series-${i + 1})` }}
              />
              {nameOf(t)}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  )
}

/* ----------------------------------------------------------------
 * MetaOverview: 2×2 / 1×4 grid of the four cards
 * ---------------------------------------------------------------- */

export const MetaOverview = ({ data }: MetaOverviewProps) => (
  <div className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-2 min-[1200px]:grid-cols-4">
    <ActivityCard data={data} />
    <TierDistCard data={data} />
    <TurnAdvantageCard data={data} />
    <TrendCard data={data} />
  </div>
)
