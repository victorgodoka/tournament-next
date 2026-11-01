import { twMerge } from 'tailwind-merge'

export type Stat = {
  label: React.ReactNode
  value: React.ReactNode
  /** Sign picks ▲ / ▼ / ●; `deltaLabel` replaces the number when words say it better. */
  delta?: number
  deltaLabel?: React.ReactNode
  /** Muted line under the value when there's no delta. */
  hint?: React.ReactNode
  /** Only when the color means something: cyan your own live rating, gold titles and prizes. */
  tone?: 'cyan' | 'gold' | 'negative'
}

const TONE = { cyan: 'text-cyan', gold: 'text-gold', negative: 'text-crimson-lift' }

const Delta = ({ delta, label }: { delta: number; label?: React.ReactNode }) => {
  const [mark, color] = delta > 0 ? ['▲', 'text-win'] : delta < 0 ? ['▼', 'text-loss'] : ['●', 'text-draw']
  return <span className={twMerge('font-sans text-[13px] leading-4.5 font-bold', color)}>{mark} {label ?? Math.abs(delta)}</span>
}

type StatGridProps = {
  items: Stat[]
  /** Defaults to one row of up to four. Below 720px the grid always drops to two. */
  columns?: number
  className?: string
}

/** A row of figures split by hairline gaps over `line`, never bordered boxes. */
export const StatGrid = ({ items, columns = Math.min(items.length, 4), className }: StatGridProps) => (
  <dl
    style={{ '--cols': columns } as React.CSSProperties}
    className={twMerge('grid grid-cols-2 gap-px border border-line bg-line min-[720px]:grid-cols-[repeat(var(--cols),minmax(0,1fr))]', className)}
  >
    {items.map((item, i) => (
      <div key={i} className="flex min-w-0 flex-col gap-2 bg-surface-100 px-5 pt-4 pb-5">
        <dt className="text-ink-muted signal">{item.label}</dt>
        <dd className={twMerge('whitespace-nowrap stat-lg', item.tone ? TONE[item.tone] : 'text-ink')}>{item.value}</dd>
        {item.delta != null ? (
          <Delta delta={item.delta} label={item.deltaLabel} />
        ) : item.hint ? (
          <span className="text-ink-muted font-sans text-[13px] leading-4.5">{item.hint}</span>
        ) : null}
      </div>
    ))}
  </dl>
)
