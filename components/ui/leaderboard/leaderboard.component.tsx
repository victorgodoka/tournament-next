import { twMerge } from 'tailwind-merge'
import type { Cosmetics, Tier } from '@utils/types'
import { Avatar } from '@ui/avatar'
import { TierBadge } from '@ui/tier-badge'

export type LeaderboardRow = {
  rank: number
  name: string
  avatar?: string | null
  cosmetics?: Cosmetics | null
  tier: Tier
  /** Pre-formatted with a thin-space thousands separator: "1 842". */
  elo: React.ReactNode
  w: number
  l: number
  d?: number
  /** 24-hour move. */
  trend?: number
  /** The signed-in duelist: steel fill and a cyan bar. Keep it last when it's out of range. */
  me?: boolean
}

const COLS = 'grid grid-cols-[64px_minmax(0,1fr)_132px_84px_104px_56px] items-center gap-3 py-2.5 pr-4'
const RANK = ['', 'text-gold', 'text-tier-silver', 'text-tier-bronze']

const Trend = ({ trend }: { trend: number }) => (
  <span className={trend > 0 ? 'text-win' : trend < 0 ? 'text-loss' : 'text-draw'}>
    {trend > 0 ? '▲' : trend < 0 ? '▼' : '●'} {Math.abs(trend)}
  </span>
)

/** Ranked rows split by hairline gaps: rank in Anton, duelist, tier, Elo, record, 24h move. */
export const Leaderboard = ({ rows, label = 'Leaderboard', className }: { rows: LeaderboardRow[]; label?: string; className?: string }) => (
  <div role="table" aria-label={label} className={twMerge('flex flex-col gap-px overflow-x-auto border border-line bg-line', className)}>
    <div role="row" className={twMerge(COLS, 'min-w-max bg-surface-200 py-2 text-ink-muted signal-sm')}>
      <span role="columnheader" className="text-center">#</span>
      <span role="columnheader">Duelist</span>
      <span role="columnheader">Tier</span>
      <span role="columnheader" className="text-right">Elo</span>
      <span role="columnheader" className="text-right">Record</span>
      <span role="columnheader" className="text-right">24h</span>
    </div>
    {rows.map((row) => (
      <div
        key={row.rank}
        role="row"
        className={twMerge(
          COLS,
          'min-w-max text-sm text-ink-dim',
          row.me ? 'bg-steel shadow-selected' : 'bg-surface-100 hover:bg-surface-300',
        )}
      >
        <span role="cell" className={twMerge('text-center stat', RANK[row.rank] ?? 'text-ink-dim')}>{row.rank}</span>
        <span role="cell" className="flex min-w-0 items-center gap-3">
          <Avatar name={row.name} src={row.avatar} cosmetics={row.cosmetics} size="sm" />
          <span className="truncate font-bold text-ink">{row.name}</span>
        </span>
        <span role="cell"><TierBadge tier={row.tier} /></span>
        <span role="cell" className="text-right font-display text-[22px] leading-none text-ink tabular-nums">{row.elo}</span>
        <span role="cell" className="text-right font-mono text-xs tabular-nums">
          {row.w}–{row.l}{row.d ? `–${row.d}` : ''}
        </span>
        <span role="cell" className="text-right font-mono text-xs tabular-nums">{row.trend == null ? null : <Trend trend={row.trend} />}</span>
      </div>
    ))}
  </div>
)
