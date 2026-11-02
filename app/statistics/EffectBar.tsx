'use client'

import { twMerge } from 'tailwind-merge'
import { effectPoints } from '@utils/statistics'

const SCALE = 5
const at = (points: number) => `${50 + Math.max(-1, Math.min(1, points / SCALE)) * 50}%`
const signed = (points: number) => `${points >= 0 ? '+' : '−'}${Math.abs(points).toFixed(1)}`

/** A card's effect in points of win rate with its 95% interval, around 0, ±5 points wide. No effect is `—`. */
export const EffectBar = ({ effect, se }: { effect: number | null; se: number | null }) => {
  if (effect == null || se == null) return <span className="text-ink-muted">—</span>
  const lo = effectPoints(effect - 1.96 * se)
  const hi = effectPoints(effect + 1.96 * se)
  const label = `${signed(effectPoints(effect))} (${signed(lo)} to ${signed(hi)})`
  return (
    <span className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2">
      <span role="img" aria-label={label} title={label} className="relative block h-3.5 bg-surface-200">
        <span aria-hidden className="absolute top-0 bottom-0 left-1/2 w-px bg-line-strong" />
        <span aria-hidden className={twMerge('absolute top-1 h-1.5', lo > 0 ? 'bg-win' : hi < 0 ? 'bg-loss' : 'bg-series-3')} style={{ left: at(lo), right: `calc(100% - ${at(hi)})` }} />
      </span>
      <span className="text-right font-mono text-xs text-ink tabular-nums">{signed(effectPoints(effect))}</span>
    </span>
  )
}
