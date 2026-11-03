/**
 * The My statistics gap tracks: the average pilot as a line in the middle, your gap as a bar from it and its 95%
 * interval as a whisker, on ±`range` points. Sizes follow the design's rows; colors follow the verdict.
 */

import { twMerge } from 'tailwind-merge'
import { at, BAR, span, WHISKER, type Read } from '@app/statistics/format'

type Size = 'row' | 'opponent' | 'week' | 'turn' | 'list'

/** Top and height of the center line, whisker and bar, per row height. */
const GEOMETRY: Record<Size, { h: number; line: [number, number]; whisker: number; bar: [number, number] }> = {
  row: { h: 64, line: [18, 18], whisker: 31, bar: [26, 12] },
  opponent: { h: 58, line: [16, 16], whisker: 28, bar: [23, 12] },
  week: { h: 52, line: [14, 14], whisker: 25, bar: [21, 10] },
  turn: { h: 22, line: [0, 0], whisker: 10, bar: [6, 10] },
  list: { h: 16, line: [0, 0], whisker: 7, bar: [3, 10] },
}

export const GapLine = ({ gap, lo, hi, read, range, size, gold = true, className }: {
  gap: number
  lo: number
  hi: number
  read: Read
  range: number
  size: Size
  /** The average pilot in gold (tables) or a plain line (turn order). */
  gold?: boolean
  className?: string
}) => {
  const g = GEOMETRY[size]
  const a = Math.min(0, gap)
  const b = Math.max(0, gap)
  return (
    <span aria-hidden className={twMerge('relative block', className)} style={{ height: g.h }}>
      <span
        className={twMerge('absolute left-1/2', gold ? '-ml-px w-0.5 bg-gold' : 'w-px bg-line-mid')}
        style={{ top: g.line[0], bottom: g.line[1] }}
      />
      <span className={twMerge('absolute h-0.5', WHISKER[read])} style={{ top: g.whisker, left: at(lo, -range, range), width: span(lo, hi, -range, range) }} />
      <span className={twMerge('absolute rounded-xs', BAR[read])} style={{ top: g.bar[0], height: g.bar[1], left: at(a, -range, range), width: span(a, b, -range, range) }} />
    </span>
  )
}

/** The overview's ±10 track: interval, gap bar and a white tick on your result. */
export const HeroLine = ({ gap, lo, hi, read, compact }: { gap: number; lo: number; hi: number; read: Read; compact?: boolean }) => {
  const R = 10
  const a = Math.min(0, gap)
  const b = Math.max(0, gap)
  const bar = read === 'good' ? 'bg-win' : read === 'bad' ? 'bg-loss' : 'bg-ink-muted'
  return (
    <span aria-hidden className={twMerge('relative block bg-space-000/35', compact ? 'h-8' : 'h-10')}>
      <span className="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-gold" />
      <span className={twMerge('absolute h-0.5 bg-ink-dim', compact ? 'top-[15px]' : 'top-[19px]')} style={{ left: at(lo, -R, R), width: span(lo, hi, -R, R) }} />
      <span className={twMerge('absolute rounded-xs', bar, compact ? 'top-[9px] h-3.5' : 'top-3 h-4')} style={{ left: at(a, -R, R), width: span(a, b, -R, R) }} />
      <span className={twMerge('absolute -ml-0.5 w-1 bg-ink', compact ? 'top-1 h-6' : 'top-1.5 h-7')} style={{ left: at(gap, -R, R) }} />
    </span>
  )
}

/** One deck's wins above expected on ±`range`, from the middle. */
export const WinsBar = ({ wins, range, compact, className }: { wins: number; range: number; compact?: boolean; className?: string }) => {
  const a = Math.min(0, wins)
  const b = Math.max(0, wins)
  return (
    <span aria-hidden className={twMerge('relative block', compact ? 'h-2' : 'h-3', className)}>
      <span className={twMerge('absolute left-1/2 w-px bg-line-mid', compact ? '-inset-y-0.5' : '-inset-y-0.75')} />
      <span className={twMerge('absolute inset-y-0 rounded-xs', wins > 0 ? 'bg-win' : 'bg-loss')} style={{ left: at(a, -range, range), width: span(a, b, -range, range) }} />
    </span>
  )
}
