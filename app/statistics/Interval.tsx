'use client'

import { twMerge } from 'tailwind-merge'
import { matchupCall } from '@utils/statistics'
import { range, value as rate } from './shared'

const MIN = 0.4
const SPAN = 0.3
const at = (rate: number) => `${Math.min(100, Math.max(0, ((rate - MIN) / SPAN) * 100))}%`

/**
 * An estimate on a 40–70% scale: its interval as a band, the value as a tick, an optional expected tick.
 * With `expected`, the band is colored only when the interval excludes it (`matchupCall`).
 */
export const Interval = ({ lo, hi, value, expected, className }: { lo: number; hi: number; value: number; expected?: number; className?: string }) => {
  const call = expected == null ? 'neutral' : matchupCall({ wrLo: lo, wrHi: hi, wrExpected: expected })
  return (
    <span role="img" aria-label={`${range(lo, hi)}, value ${rate(value)}`} className={twMerge('relative block h-3.5 min-w-20 bg-surface-200', className)}>
      <span aria-hidden className="absolute top-0 bottom-0 w-px bg-line-strong" style={{ left: at(0.5) }} />
      <span aria-hidden className={twMerge('absolute top-1 h-1.5', call === 'favorable' ? 'bg-win' : call === 'unfavorable' ? 'bg-loss' : 'bg-series-3')} style={{ left: at(lo), right: `calc(100% - ${at(hi)})` }} />
      <span aria-hidden className="absolute top-0.5 h-2.5 w-0.5 bg-ink" style={{ left: at(value) }} />
      {expected != null ? <span aria-hidden className="absolute top-0 bottom-0 w-px bg-gold" style={{ left: at(expected) }} /> : null}
    </span>
  )
}
