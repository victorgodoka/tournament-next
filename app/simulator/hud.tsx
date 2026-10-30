'use client'

import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import type { Board, Pile } from '@utils/simulator/types'

const FULL = 8000
const PILES: Exclude<Pile, 'hand'>[] = ['deck', 'extra', 'gy', 'banished']

type LifePlateProps = {
  /** The player's plate is the page's one steel surface. */
  mine?: boolean
  label: string
  lp: number
  className?: string
}

/** A duelist's Life Points: the number in Anton over a bar that drains from 8000. */
export const LifePlate = ({ mine = false, label, lp, className }: LifePlateProps) => (
  <div
    className={twMerge(
      'cut notch flex w-44 flex-col gap-1 px-3 pt-2 pb-2.5 [--cut:var(--cut-md)]',
      mine ? '[--edge:var(--color-steel-edge)] [--fill:var(--color-steel)]' : '[--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]',
      className,
    )}
  >
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-dim signal">{label}</span>
      <span className="text-ink stat-lg">{lp}</span>
    </div>
    <span aria-hidden className="block h-1 bg-space-000">
      <span style={{ width: `${Math.min(100, (lp / FULL) * 100)}%` }} className="block h-full bg-cyan" />
    </span>
  </div>
)

/** Each pile's count, a button that opens it: the way in when a card's corner on the table is small to hit. */
export const PileCounts = ({ board, onPile }: { board: Board; onPile(pile: Pile): void }) => {
  const t = useTranslations('Simulator')
  return (
    <div className="sim-rail-section grid grid-cols-4 gap-1">
      {PILES.map((pile) => (
        <Button key={pile} variant="secondary" size="mono" aria-label={t('rail.open', { zone: t(`zones.${pile}`) })} onClick={() => onPile(pile)} className="h-auto flex-col gap-1 px-1 py-2">
          <span className="text-ink stat">{board.zones[pile].length}</span>
          <span className="text-ink-muted signal-sm tracking-normal">{t(`rail.${pile}`)}</span>
        </Button>
      ))}
    </div>
  )
}
